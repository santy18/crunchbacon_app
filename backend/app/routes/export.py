import io
import json
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

router = APIRouter()


@router.post("/export-edited-video")
async def export_edited_video(
    video: UploadFile = File(...),
    audio: UploadFile = File(...),
    segments: str = Form(...),
):
    try:
        keep_segments = json.loads(segments)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid segments JSON")

    if not keep_segments:
        raise HTTPException(status_code=400, detail="No segments to keep")

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)

        video_ext = Path(video.filename).suffix or ".mp4"
        video_path = tmp / f"input{video_ext}"
        video_path.write_bytes(await video.read())

        audio_path = tmp / "audio.wav"
        audio_path.write_bytes(await audio.read())

        output_path = tmp / "output.mp4"

        has_cuts = len(keep_segments) > 1 or (len(keep_segments) == 1 and keep_segments[0][0] > 0.01)

        if not has_cuts:
            cmd = [
                "ffmpeg", "-y",
                "-i", str(video_path),
                "-i", str(audio_path),
                "-c:v", "copy",
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-shortest",
                str(output_path),
            ]
        else:
            filters = []
            concat_inputs = []
            for i, (start, end) in enumerate(keep_segments):
                filters.append(
                    f"[0:v]trim={start}:{end},setpts=PTS-STARTPTS[v{i}]"
                )
                concat_inputs.append(f"[v{i}]")

            n = len(keep_segments)
            concat_str = "".join(concat_inputs)
            filters.append(f"{concat_str}concat=n={n}:v=1:a=0[outv]")
            filter_complex = ";".join(filters)

            cmd = [
                "ffmpeg", "-y",
                "-i", str(video_path),
                "-i", str(audio_path),
                "-filter_complex", filter_complex,
                "-map", "[outv]",
                "-map", "1:a:0",
                "-shortest",
                str(output_path),
            ]

        result = subprocess.run(cmd, capture_output=True, timeout=300)
        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"FFmpeg error: {result.stderr.decode()[:500]}",
            )

        buffer = io.BytesIO(output_path.read_bytes())
        return StreamingResponse(buffer, media_type="video/mp4", headers={
            "Content-Disposition": 'attachment; filename="edited_video.mp4"'
        })


@router.post("/export-project")
async def export_project(request: Request):
    form = await request.form()

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
                print(f"[export] Saved media {media_id} -> {media_path} ({len(content)} bytes)")

        clips.sort(key=lambda c: c["startTime"])

        video_clips = [c for c in clips if track_types.get(c["trackId"]) in ("video", "image")]
        audio_clips = [c for c in clips if track_types.get(c["trackId"]) == "audio"]
        print(f"[export] {len(video_clips)} video clip(s), {len(audio_clips)} audio clip(s)")

        output_path = tmp / "output.mp4"

        inputs = []
        input_map = {}
        for c in clips:
            mid = c["mediaId"]
            if mid not in input_map:
                media_path = media_files.get(mid)
                if not media_path:
                    raise HTTPException(status_code=400, detail=f"Media file not found for media {mid}")
                input_map[mid] = len(inputs)
                inputs.append(media_path)

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

        filter_complex = ";".join(filters)

        cmd = ["ffmpeg", "-y"]
        for inp in inputs:
            cmd.extend(["-i", inp])
        cmd.extend(["-filter_complex", filter_complex])
        cmd.extend(maps)
        if not v_labels:
            cmd.extend(["-vn"])
        cmd.append(str(output_path))

        print(f"[export] Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, timeout=300)
        if result.returncode != 0:
            stderr = result.stderr.decode()[:800]
            print(f"[export] FFmpeg FAILED:\n{stderr}")
            raise HTTPException(status_code=500, detail=f"FFmpeg error: {stderr}")

        print(f"[export] Success! Output: {output_path} ({output_path.stat().st_size} bytes)")
        buffer = io.BytesIO(output_path.read_bytes())
        return StreamingResponse(buffer, media_type="video/mp4", headers={
            "Content-Disposition": 'attachment; filename="project_export.mp4"'
        })
