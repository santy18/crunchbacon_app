from abc import ABC, abstractmethod
from pathlib import Path
import hashlib
import base64
import secrets

import httpx


class SocialPlatform(ABC):
    """Base class for social media platform integrations."""

    name: str
    required_secrets: list[str]  # keys expected in settings (without secret_ prefix)

    @abstractmethod
    async def upload_video(
        self,
        video_path: Path,
        access_token: str,
        title: str = "",
        privacy: str = "SELF_ONLY",
    ) -> dict:
        """Upload a video and return {"publish_id": ..., "status": ...}."""
        ...

    @abstractmethod
    async def check_status(self, publish_id: str, access_token: str) -> dict:
        """Check the publish status of a previously uploaded video."""
        ...

    @abstractmethod
    def get_oauth_url(self, client_key: str, redirect_uri: str, state: str, code_challenge: str = None, scopes: str = None) -> str:
        """Return the OAuth authorization URL for this platform."""
        ...

    @abstractmethod
    async def exchange_code(
        self, code: str, client_key: str, client_secret: str, redirect_uri: str, code_verifier: str = None
    ) -> dict:
        """Exchange an authorization code for access/refresh tokens."""
        ...


class TikTokPlatform(SocialPlatform):
    name = "tiktok"
    required_secrets = ["tiktok_client_key", "tiktok_client_secret"]

    OAUTH_BASE = "https://www.tiktok.com/v2/auth/authorize/"
    TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
    PUBLISH_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/"
    STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/"

    def get_oauth_url(self, client_key: str, redirect_uri: str, state: str, code_challenge: str = None, scopes: str = None) -> str:
        from urllib.parse import urlencode

        params = {
            "client_key": client_key,
            "response_type": "code",
            "scope": scopes or "video.publish video.upload",
            "redirect_uri": redirect_uri,
            "state": state,
        }
        if code_challenge:
            params["code_challenge"] = code_challenge
            params["code_challenge_method"] = "S256"
            
        return f"{self.OAUTH_BASE}?{urlencode(params)}"

    async def exchange_code(
        self, code: str, client_key: str, client_secret: str, redirect_uri: str, code_verifier: str = None
    ) -> dict:
        async with httpx.AsyncClient() as client:
            data = {
                "client_key": client_key,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            }
            if code_verifier:
                data["code_verifier"] = code_verifier

            resp = await client.post(
                self.TOKEN_URL,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            return resp.json()

    async def refresh_access_token(
        self, refresh_token: str, client_key: str, client_secret: str
    ) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                self.TOKEN_URL,
                data={
                    "client_key": client_key,
                    "client_secret": client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            return resp.json()

    async def upload_video(
        self,
        video_path: Path,
        access_token: str,
        title: str = "",
        privacy: str = "SELF_ONLY",
    ) -> dict:
        video_size = video_path.stat().st_size

        # Step 1: Initialize upload
        init_body = {
            "post_info": {
                "title": title or "Uploaded via CrunchBacon",
                "privacy_level": privacy,
            },
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": video_size,
                "chunk_size": video_size,
                "total_chunk_count": 1,
            },
        }

        async with httpx.AsyncClient(timeout=120) as client:
            init_resp = await client.post(
                self.PUBLISH_URL,
                json=init_body,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=UTF-8",
                },
            )
            if init_resp.status_code != 200:
                print(f"[TikTok] Init failed: {init_resp.status_code} {init_resp.text}")
            init_resp.raise_for_status()
            init_data = init_resp.json()

            if init_data.get("error", {}).get("code") != "ok":
                return {
                    "status": "error",
                    "detail": init_data.get("error", {}).get("message", "Init failed"),
                }

            publish_id = init_data["data"]["publish_id"]
            upload_url = init_data["data"]["upload_url"]

            # Step 2: Upload the video file
            video_bytes = video_path.read_bytes()
            upload_resp = await client.put(
                upload_url,
                content=video_bytes,
                headers={
                    "Content-Range": f"bytes 0-{video_size - 1}/{video_size}",
                    "Content-Type": "video/mp4",
                },
            )
            upload_resp.raise_for_status()

        return {"publish_id": publish_id, "status": "processing"}

    async def check_status(self, publish_id: str, access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                self.STATUS_URL,
                json={"publish_id": publish_id},
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=UTF-8",
                },
            )
            resp.raise_for_status()
            return resp.json()


# Registry of available platforms
PLATFORMS: dict[str, SocialPlatform] = {
    "tiktok": TikTokPlatform(),
}


def get_platform(name: str) -> SocialPlatform | None:
    return PLATFORMS.get(name)


def generate_pkce_pair():
    """Generate a code_verifier and code_challenge for PKCE."""
    # code_verifier: high-entropy cryptographic random string
    # Length must be between 43 and 128 characters
    code_verifier = secrets.token_urlsafe(64)
    
    # code_challenge = BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))
    sha256_hash = hashlib.sha256(code_verifier.encode('ascii')).digest()
    code_challenge = base64.urlsafe_b64encode(sha256_hash).decode('ascii').replace('=', '')
    
    return code_verifier, code_challenge
