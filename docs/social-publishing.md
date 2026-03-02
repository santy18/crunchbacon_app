# Social Media Publishing

Publish videos directly from the CrunchBacon editor to social media platforms. Currently supports TikTok, with a plugin architecture designed for adding more platforms.

## Architecture Overview

```
Frontend                          Backend
--------                          -------
Settings.jsx                      routes/settings.py
  - Save API credentials  ──>      PUT /settings/encrypted/{key}
  - Connect account        ──>      GET /social/oauth/{platform}/start
                                    GET /social/oauth/{platform}/callback

Editor > PublishButton.jsx        routes/social.py
  - Select platforms       ──>      GET /social/platforms
  - Publish video          ──>      POST /social/publish
                                      ├── FFmpeg export (temp MP4)
                                      └── Platform upload (via services/social.py)
```

### Key Files

| File | Purpose |
|------|---------|
| `backend/app/encryption.py` | Fernet symmetric encryption for secrets |
| `backend/app/services/social.py` | Platform abstraction and implementations |
| `backend/app/routes/social.py` | Social API endpoints (OAuth, publish, status) |
| `backend/app/routes/settings.py` | Encrypted settings endpoints |
| `frontend/src/pages/Settings.jsx` | Credential input and OAuth connection UI |
| `frontend/src/editor/PublishButton.jsx` | Publish button with platform picker |

## How It Works

### 1. Credential Storage

API keys are encrypted before being stored in the `settings` table using Fernet symmetric encryption (`cryptography` library).

- Encryption key is auto-generated on first use and saved to `backend/data/.encryption_key`
- Settings with sensitive values are stored with a `secret_` key prefix (e.g., `secret_tiktok_client_key`)
- The `GET /settings/encrypted/{key}` endpoint returns masked values by default (e.g., `*************ab12`)

### 2. OAuth Flow (TikTok)

1. User enters Client Key and Client Secret in Settings (from [TikTok Developer Portal](https://developers.tiktok.com/))
2. User clicks "Connect TikTok"
3. Frontend calls `GET /social/oauth/tiktok/start` which returns an authorization URL
4. A new browser tab opens to TikTok's consent page
5. After approval, TikTok redirects to `GET /social/oauth/tiktok/callback`
6. The backend exchanges the authorization code for access/refresh tokens and stores them encrypted
7. The callback page shows a success message; user closes the tab

### 3. Publishing

1. User clicks "Publish" in the editor toolbar
2. A dropdown shows connected platforms with checkboxes and an optional title field
3. On confirm, the frontend sends the same project data as the export flow to `POST /social/publish`
4. The backend:
   - Saves uploaded media files to a temp directory
   - Runs FFmpeg to compose the final MP4 (same pipeline as `/export-project`)
   - Reads the encrypted access token for each selected platform
   - Calls the platform's `upload_video()` method
   - Returns per-platform results

### 4. TikTok Upload (Content Posting API v2)

The upload uses TikTok's [Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started):

1. **Init** — `POST /v2/post/publish/video/init/` with video size and post metadata. Returns an `upload_url` and `publish_id`.
2. **Upload** — `PUT` the video bytes to the `upload_url` with `Content-Range` header.
3. TikTok processes the video asynchronously. Status can be checked with `POST /v2/post/publish/status/fetch/`.

## API Endpoints

### Settings (encrypted)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PUT` | `/settings/encrypted/{key}` | Encrypt and store a secret |
| `GET` | `/settings/encrypted/{key}` | Get masked value (`?reveal=true` for plaintext) |
| `DELETE` | `/settings/encrypted/{key}` | Delete a secret |

### Social

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/social/platforms` | List platforms with connection status |
| `GET` | `/social/oauth/tiktok/start` | Get TikTok OAuth authorization URL |
| `GET` | `/social/oauth/tiktok/callback` | OAuth redirect handler |
| `POST` | `/social/publish` | Export project and upload to platforms |

### POST /social/publish

Multipart form fields:

| Field | Type | Description |
|-------|------|-------------|
| `project` | JSON string | Project data (tracks + clips) |
| `media_*` | File | Media files keyed by media ID |
| `platforms` | string | Comma-separated platform names (e.g., `"tiktok"`) |
| `title` | string | Optional video title/caption |

Response:

```json
{
  "results": {
    "tiktok": {
      "publish_id": "abc123",
      "status": "processing"
    }
  }
}
```

## Adding a New Platform

### 1. Create the platform class

In `backend/app/services/social.py`, add a new class that extends `SocialPlatform`:

```python
class InstagramPlatform(SocialPlatform):
    name = "instagram"
    required_secrets = ["instagram_client_id", "instagram_client_secret"]

    def get_oauth_url(self, client_key, redirect_uri, state):
        # Build and return the Instagram OAuth URL
        ...

    async def exchange_code(self, code, client_key, client_secret, redirect_uri):
        # Exchange auth code for access token
        # Return dict with "access_token", "refresh_token", etc.
        ...

    async def upload_video(self, video_path, access_token, title="", privacy="SELF_ONLY"):
        # Upload the video file using the platform's API
        # Return {"publish_id": "...", "status": "processing"}
        ...

    async def check_status(self, publish_id, access_token):
        # Check publish status
        # Return the platform's status response
        ...
```

The four abstract methods you must implement:

| Method | Purpose |
|--------|---------|
| `get_oauth_url()` | Build the OAuth authorization URL for user consent |
| `exchange_code()` | Exchange the OAuth callback code for access/refresh tokens |
| `upload_video()` | Upload an MP4 file and return a publish ID |
| `check_status()` | Check whether a publish has completed |

### 2. Register it

Add the instance to the `PLATFORMS` dict in the same file:

```python
PLATFORMS: dict[str, SocialPlatform] = {
    "tiktok": TikTokPlatform(),
    "instagram": InstagramPlatform(),  # <-- add here
}
```

### 3. Add OAuth routes

In `backend/app/routes/social.py`, add start and callback endpoints for the new platform:

```python
@router.get("/oauth/instagram/start")
async def instagram_oauth_start(request: Request, db: AsyncSession = Depends(get_db)):
    platform = get_platform("instagram")
    client_key = await _get_secret("instagram_client_id", db)
    if not client_key:
        raise HTTPException(status_code=400, detail="Instagram Client ID not configured")

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = "instagram"

    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/social/oauth/instagram/callback"
    url = platform.get_oauth_url(client_key, redirect_uri, state)
    return {"authorization_url": url}


@router.get("/oauth/instagram/callback", response_class=HTMLResponse)
async def instagram_oauth_callback(code: str = "", state: str = "", ...):
    # Same pattern as tiktok_oauth_callback:
    # 1. Validate state
    # 2. Exchange code for tokens
    # 3. Store tokens encrypted
    # 4. Return success HTML
    ...
```

### 4. No frontend changes needed

The Settings page and PublishButton automatically discover platforms from `GET /social/platforms`. The new platform will appear in both places as soon as it's registered in the `PLATFORMS` dict. The Settings UI renders a credential card for each platform, and the PublishButton shows a checkbox for each connected platform.

## Dependencies

| Package | Purpose |
|---------|---------|
| `cryptography` | Fernet encryption for API keys and tokens |
| `httpx` | Async HTTP client for platform API calls |

Install with:

```
pip install cryptography httpx
```

## TikTok Developer Setup

1. Go to [TikTok for Developers](https://developers.tiktok.com/) and create an app
2. Enable the **Content Posting API** product
3. Set the redirect URI to `http://localhost:8000/social/oauth/tiktok/callback`
4. Copy the **Client Key** and **Client Secret** into the CrunchBacon Settings page
5. Click "Connect TikTok" to authorize
