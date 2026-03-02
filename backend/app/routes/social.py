import io
import json
import secrets
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..encryption import decrypt_value, encrypt_value
from ..models import Setting
from ..services.social import PLATFORMS, get_platform, generate_pkce_pair

router = APIRouter(prefix="/social", tags=["social"])

# In-memory state for OAuth CSRF protection and PKCE
# Format: { state: {"platform": str, "code_verifier": str} }
_oauth_states: dict[str, dict] = {}


async def _get_secret(key: str, db: AsyncSession) -> str | None:
    """Retrieve and decrypt a secret setting."""
    db_key = f"secret_{key}"
    result = await db.execute(select(Setting).where(Setting.key == db_key))
    setting = result.scalar_one_or_none()
    if not setting or not setting.value:
        return None
    return decrypt_value(setting.value).strip()


async def _set_secret(key: str, value: str, db: AsyncSession):
    """Encrypt and store a secret setting."""
    db_key = f"secret_{key}"
    encrypted = encrypt_value(value)
    result = await db.execute(select(Setting).where(Setting.key == db_key))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = encrypted
    else:
        setting = Setting(key=db_key, value=encrypted)
        db.add(setting)


@router.get("/platforms")
async def list_platforms(db: AsyncSession = Depends(get_db)):
    """Return all supported platforms and their connection status."""
    platforms = []
    for name, platform in PLATFORMS.items():
        has_credentials = True
        for secret_key in platform.required_secrets:
            val = await _get_secret(secret_key, db)
            if not val:
                has_credentials = False
                break

        has_token = await _get_secret(f"{name}_access_token", db) is not None

        platforms.append({
            "name": name,
            "has_credentials": has_credentials,
            "connected": has_token,
        })
    return platforms


# --- TikTok OAuth ---


@router.get("/oauth/tiktok/start")
async def tiktok_oauth_start(request: Request, db: AsyncSession = Depends(get_db)):
    """Generate a TikTok OAuth authorization URL."""
    platform = get_platform("tiktok")
    if not platform:
        raise HTTPException(status_code=404, detail="TikTok platform not found")

    client_key = await _get_secret("tiktok_client_key", db)
    if not client_key:
        raise HTTPException(status_code=400, detail="TikTok Client Key not configured. Add it in Settings first.")

    print(f"[OAuth] Using Client Key starting with: {client_key[:4]}...")

    state = secrets.token_urlsafe(32)
    code_verifier, code_challenge = generate_pkce_pair()
    
    _oauth_states[state] = {
        "platform": "tiktok",
        "code_verifier": code_verifier
    }

    redirect_base = await _get_secret("tiktok_redirect_base", db)
    if not redirect_base:
        redirect_base = str(request.base_url).rstrip("/")
        
    redirect_uri = f"{redirect_base}/social/oauth/tiktok/callback"
    print(f"[OAuth] Generated Redirect URI: {redirect_uri}")

    custom_scopes = await _get_secret("tiktok_scopes", db)
    if custom_scopes:
        print(f"[OAuth] Using custom scopes: {custom_scopes}")
        # Ensure we pass the custom scopes to get_oauth_url
        url = platform.get_oauth_url(client_key, redirect_uri, state, code_challenge=code_challenge, scopes=custom_scopes)
    else:
        url = platform.get_oauth_url(client_key, redirect_uri, state, code_challenge=code_challenge)
    
    print(f"[OAuth] Full Auth URL: {url}")
    return {"authorization_url": url}


@router.get("/oauth/tiktok/callback", response_class=HTMLResponse)
async def tiktok_oauth_callback(
    code: str = "",
    state: str = "",
    error: str = "",
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Handle the OAuth callback from TikTok."""
    if error:
        return HTMLResponse(f"""
            <html><body style="background:#1a1a1a;color:#fff;font-family:sans-serif;display:flex;
            justify-content:center;align-items:center;height:100vh;margin:0">
            <div style="text-align:center"><h2>Authorization Failed</h2>
            <p>{error}</p><p>You can close this tab.</p></div></body></html>
        """)

    if state not in _oauth_states:
        return HTMLResponse("""
            <html><body style="background:#1a1a1a;color:#fff;font-family:sans-serif;display:flex;
            justify-content:center;align-items:center;height:100vh;margin:0">
            <div style="text-align:center"><h2>Invalid State</h2>
            <p>CSRF validation failed. Please try again.</p></div></body></html>
        """)

    state_data = _oauth_states.pop(state)
    code_verifier = state_data.get("code_verifier")

    platform = get_platform("tiktok")
    client_key = await _get_secret("tiktok_client_key", db)
    client_secret = await _get_secret("tiktok_client_secret", db)

    if not client_key or not client_secret:
        raise HTTPException(status_code=400, detail="TikTok credentials not configured")

    redirect_base = await _get_secret("tiktok_redirect_base", db)
    if not redirect_base:
        redirect_base = str(request.base_url).rstrip("/")
        
    redirect_uri = f"{redirect_base}/social/oauth/tiktok/callback"
    print(f"[OAuth] Generated Redirect URI: {redirect_uri}")

    try:
        token_data = await platform.exchange_code(
            code, client_key, client_secret, redirect_uri, code_verifier=code_verifier
        )
        print(f"[OAuth] Received token data keys: {list(token_data.keys())}")
        if "data" in token_data:
            print(f"[OAuth] Received nested data keys: {list(token_data['data'].keys())}")
    except Exception as e:
        print(f"[OAuth] Token exchange error: {e}")
        return HTMLResponse(f"""
            <html><body style="background:#1a1a1a;color:#fff;font-family:sans-serif;display:flex;
            justify-content:center;align-items:center;height:100vh;margin:0">
            <div style="text-align:center"><h2>Token Exchange Failed</h2>
            <p>{e}</p><p>You can close this tab.</p></div></body></html>
        """)

    # TikTok v2 token response is nested under 'data'
    # { "data": { "access_token": "...", ... } }
    data = token_data.get("data", {})
    
    # Fallback to top-level if 'data' is missing (some versions/endpoints)
    access_token = data.get("access_token") or token_data.get("access_token")
    refresh_token = data.get("refresh_token") or token_data.get("refresh_token")
    open_id = data.get("open_id") or data.get("user_openid") or token_data.get("open_id")

    if access_token:
        print(f"[OAuth] Saving access_token for {platform.name}")
        await _set_secret(f"{platform.name}_access_token", access_token, db)
    else:
        print(f"[OAuth] WARNING: No access_token found in response!")
        
    if refresh_token:
        await _set_secret(f"{platform.name}_refresh_token", refresh_token, db)
    if open_id:
        await _set_secret(f"{platform.name}_open_id", open_id, db)
    
    await db.commit()

    return HTMLResponse("""
        <html><body style="background:#1a1a1a;color:#fff;font-family:sans-serif;display:flex;
        justify-content:center;align-items:center;height:100vh;margin:0">
        <div style="text-align:center">
        <h2 style="color:#e84393">TikTok Connected!</h2>
        <p>Your TikTok account has been linked to CrunchBacon.</p>
        <p>You can close this tab and return to the app.</p>
        </div></body></html>
    """)


# --- Publish ---


@router.post("/publish")
async def publish_to_social(request: Request, db: AsyncSession = Depends(get_db)):
    """Export project and publish to selected social platforms.

    Expects multipart form with:
    - project: JSON string (same as /export-project)
    - media_*: media files
    - platforms: comma-separated platform names (e.g. "tiktok")
    - title: optional video title
    """
    form = await request.form()

    platforms_str = form.get("platforms", "")
    if not platforms_str:
        raise HTTPException(status_code=400, detail="No platforms specified")

    platform_names = [p.strip() for p in platforms_str.split(",") if p.strip()]
    title = form.get("title", "") or ""

    project_json = form.get("project")
    if not project_json:
        raise HTTPException(status_code=400, detail="Missing project JSON")

    try:
        project = json.loads(project_json)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid project JSON")

    clips = project.get("clips", [])
    tracks = project.get("tracks", [])
    if not clips:
        raise HTTPException(status_code=400, detail="No clips to export")

    track_types = {t["id"]: t["type"] for t in tracks}

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)

        # Save media files
        media_files = {}
        for key in form:
            if key.startswith("media_"):
                media_id = key[6:]
                upload = form[key]
                ext = Path(upload.filename).suffix or ".mp4"
                media_path = tmp / f"media_{media_id}{ext}"
                content = await upload.read()
                media_path.write_bytes(content)
                media_files[media_id] = str(media_path)

        clips.sort(key=lambda c: c["startTime"])
        video_clips = [c for c in clips if track_types.get(c["trackId"]) in ("video", "image")]
        audio_clips = [c for c in clips if track_types.get(c["trackId"]) == "audio"]

        output_path = tmp / "output.mp4"

        # Build FFmpeg command (reuse same logic as export route)
        inputs = []
        input_map = {}
        for c in clips:
            mid = c["mediaId"]
            if mid not in input_map:
                media_path = media_files.get(mid)
                if not media_path:
                    raise HTTPException(status_code=400, detail=f"Media file not found for {mid}")
                input_map[mid] = len(inputs)
                inputs.append(media_path)

        # Probe resolution
        target_w, target_h = 1920, 1080
        if video_clips:
            first_media = media_files.get(video_clips[0]["mediaId"])
            if first_media:
                probe = subprocess.run(
                    ["ffprobe", "-v", "error", "-select_streams", "v:0",
                     "-show_entries", "stream=width,height", "-of", "csv=p=0",
                     first_media],
                    capture_output=True, timeout=30,
                )
                if probe.returncode == 0:
                    parts = probe.stdout.decode().strip().split(",")
                    if len(parts) == 2:
                        pw, ph = int(parts[0]), int(parts[1])
                        target_w = pw if pw % 2 == 0 else pw + 1
                        target_h = ph if ph % 2 == 0 else ph + 1

        # Build filters
        filters = []
        v_labels = []
        a_labels = []

        for i, c in enumerate(video_clips):
            idx = input_map[c["mediaId"]]
            in_pt = c.get("inPoint", 0)
            out_pt = c.get("outPoint", in_pt + c.get("duration", 0))
            speed = c.get("speed", 1)
            scale = c.get("scale", 1)
            rotation = c.get("rotation", 0)
            label = f"v{i}"
            vf = f"[{idx}:v]trim={in_pt}:{out_pt},setpts=PTS-STARTPTS"
            if speed != 1:
                vf += f",setpts={1.0/speed}*PTS"
            if scale != 1:
                vf += f",scale=iw*{scale}:ih*{scale}"
            if rotation != 0:
                vf += f",rotate={rotation}*PI/180:fillcolor=black@0"
            if len(video_clips) > 1:
                vf += f",scale={target_w}:{target_h}:force_original_aspect_ratio=decrease"
                vf += f",pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2:black"
                vf += ",format=yuv420p,setsar=1"
            vf += f"[{label}]"
            filters.append(vf)
            v_labels.append(f"[{label}]")

        for i, c in enumerate(audio_clips):
            idx = input_map[c["mediaId"]]
            in_pt = c.get("inPoint", 0)
            out_pt = c.get("outPoint", in_pt + c.get("duration", 0))
            speed = c.get("speed", 1)
            volume = c.get("volume", 1)
            label = f"a{i}"
            af = f"[{idx}:a]atrim={in_pt}:{out_pt},asetpts=PTS-STARTPTS"
            if speed != 1:
                s = speed
                tempos = []
                while s > 2.0:
                    tempos.append("atempo=2.0")
                    s /= 2.0
                while s < 0.5:
                    tempos.append("atempo=0.5")
                    s *= 2.0
                tempos.append(f"atempo={s}")
                af += "," + ",".join(tempos)
            if volume != 1:
                af += f",volume={volume}"
            af += f"[{label}]"
            filters.append(af)
            a_labels.append(f"[{label}]")

        maps = []
        if v_labels:
            if len(v_labels) == 1:
                for fi in range(len(filters)):
                    if filters[fi].endswith("[v0]"):
                        filters[fi] = filters[fi][:-4] + "[outv]"
                        break
            else:
                filters.append(f"{''.join(v_labels)}concat=n={len(v_labels)}:v=1:a=0[outv]")
            maps.extend(["-map", "[outv]"])

        if a_labels:
            if len(a_labels) == 1:
                for fi in range(len(filters)):
                    if filters[fi].endswith("[a0]"):
                        filters[fi] = filters[fi][:-4] + "[outa]"
                        break
            else:
                filters.append(f"{''.join(a_labels)}concat=n={len(a_labels)}:v=0:a=1[outa]")
            maps.extend(["-map", "[outa]"])

        cmd = ["ffmpeg", "-y"]
        for inp in inputs:
            cmd.extend(["-i", inp])
        if filters:
            cmd.extend(["-filter_complex", ";".join(filters)])
        cmd.extend(maps)
        if not v_labels:
            cmd.extend(["-vn"])
        cmd.append(str(output_path))

        result = subprocess.run(cmd, capture_output=True, timeout=300)
        if result.returncode != 0:
            stderr = result.stderr.decode()[-2000:]
            raise HTTPException(status_code=500, detail=f"FFmpeg export error: {stderr}")

        # Upload to each selected platform
        results = {}
        for pname in platform_names:
            platform = get_platform(pname)
            if not platform:
                results[pname] = {"status": "error", "detail": f"Unknown platform: {pname}"}
                continue

            access_token = await _get_secret(f"{pname}_access_token", db)
            if not access_token:
                results[pname] = {"status": "error", "detail": f"Not connected to {pname}. Connect in Settings first."}
                continue

            try:
                upload_result = await platform.upload_video(
                    output_path, access_token, title=title
                )
                results[pname] = upload_result
            except Exception as e:
                results[pname] = {"status": "error", "detail": str(e)}

    return {"results": results}
