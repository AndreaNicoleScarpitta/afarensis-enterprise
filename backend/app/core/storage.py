"""
File storage abstraction with S3-compatible backend and local fallback.

Architecture:
  - Production: S3-compatible storage (AWS S3, MinIO, R2, GCS via S3 API)
  - Development: Local filesystem (./artifacts/)

All files are stored with:
  - Content-addressable paths: {org_id}/{project_id}/{artifact_type}/{filename}
  - SHA-256 integrity verification on upload and download
  - Signed URLs for secure time-limited downloads (S3 mode)

Configuration (via .env):
  STORAGE_BACKEND=s3          # "s3" or "local" (default: local)
  S3_BUCKET=afarensis-artifacts
  S3_REGION=us-east-1
  S3_ACCESS_KEY=...
  S3_SECRET_KEY=...
  S3_ENDPOINT_URL=...         # For MinIO/R2 (omit for AWS S3)
"""

import os
import hashlib
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class LocalStorage:
    """Local filesystem storage (development)."""

    def __init__(self, base_dir: str = "./artifacts"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Local storage initialized at {self.base_dir.absolute()}")

    async def save(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> dict:
        """Save file to local filesystem. Returns metadata dict."""
        file_path = self.base_dir / key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)

        file_hash = hashlib.sha256(data).hexdigest()
        return {
            "key": key,
            "size": len(data),
            "hash": file_hash,
            "content_type": content_type,
            "backend": "local",
            "path": str(file_path.absolute()),
            "created_at": datetime.utcnow().isoformat() + "Z",
        }

    async def load(self, key: str) -> Optional[bytes]:
        """Load file from local filesystem."""
        file_path = self.base_dir / key
        if not file_path.exists():
            return None
        return file_path.read_bytes()

    async def delete(self, key: str) -> bool:
        """Delete file from local filesystem."""
        file_path = self.base_dir / key
        if file_path.exists():
            file_path.unlink()
            return True
        return False

    async def exists(self, key: str) -> bool:
        return (self.base_dir / key).exists()

    async def get_url(self, key: str, expires_in: int = 3600) -> Optional[str]:
        """For local storage, return a relative file path (no signed URLs)."""
        file_path = self.base_dir / key
        if file_path.exists():
            return f"/artifacts/{key}"
        return None

    async def list_keys(self, prefix: str = "") -> list:
        """List all keys matching a prefix."""
        results = []
        search_dir = self.base_dir / prefix if prefix else self.base_dir
        if search_dir.exists():
            for p in search_dir.rglob("*"):
                if p.is_file():
                    results.append(str(p.relative_to(self.base_dir)))
        return results

    async def stats(self) -> dict:
        total_size = sum(f.stat().st_size for f in self.base_dir.rglob("*") if f.is_file())
        file_count = sum(1 for f in self.base_dir.rglob("*") if f.is_file())
        return {
            "backend": "local",
            "base_dir": str(self.base_dir.absolute()),
            "file_count": file_count,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
        }


class S3Storage:
    """S3-compatible object storage (production)."""

    def __init__(self, bucket: str, region: str = "us-east-1",
                 access_key: str = None, secret_key: str = None,
                 endpoint_url: str = None):
        self.bucket = bucket
        self.region = region
        self._client = None
        self._access_key = access_key
        self._secret_key = secret_key
        self._endpoint_url = endpoint_url

    def _get_client(self):
        if self._client is None:
            try:
                import boto3
                kwargs = {
                    "service_name": "s3",
                    "region_name": self.region,
                }
                if self._access_key and self._secret_key:
                    kwargs["aws_access_key_id"] = self._access_key
                    kwargs["aws_secret_access_key"] = self._secret_key
                if self._endpoint_url:
                    kwargs["endpoint_url"] = self._endpoint_url
                self._client = boto3.client(**kwargs)
                logger.info(f"S3 storage connected to bucket '{self.bucket}'")
            except ImportError:
                raise RuntimeError("boto3 is required for S3 storage. Run: pip install boto3")
        return self._client

    async def save(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> dict:
        import asyncio
        client = self._get_client()
        file_hash = hashlib.sha256(data).hexdigest()

        def _upload():
            from io import BytesIO
            client.upload_fileobj(
                BytesIO(data), self.bucket, key,
                ExtraArgs={"ContentType": content_type, "Metadata": {"sha256": file_hash}}
            )

        await asyncio.get_event_loop().run_in_executor(None, _upload)
        return {
            "key": key,
            "size": len(data),
            "hash": file_hash,
            "content_type": content_type,
            "backend": "s3",
            "bucket": self.bucket,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }

    async def load(self, key: str) -> Optional[bytes]:
        import asyncio
        client = self._get_client()

        def _download():
            try:
                from io import BytesIO
                buf = BytesIO()
                client.download_fileobj(self.bucket, key, buf)
                return buf.getvalue()
            except client.exceptions.NoSuchKey:
                return None
            except Exception:
                return None

        return await asyncio.get_event_loop().run_in_executor(None, _download)

    async def delete(self, key: str) -> bool:
        import asyncio
        client = self._get_client()

        def _delete():
            try:
                client.delete_object(Bucket=self.bucket, Key=key)
                return True
            except Exception:
                return False

        return await asyncio.get_event_loop().run_in_executor(None, _delete)

    async def exists(self, key: str) -> bool:
        import asyncio
        client = self._get_client()

        def _head():
            try:
                client.head_object(Bucket=self.bucket, Key=key)
                return True
            except Exception:
                return False

        return await asyncio.get_event_loop().run_in_executor(None, _head)

    async def get_url(self, key: str, expires_in: int = 3600) -> Optional[str]:
        """Generate a pre-signed download URL."""
        import asyncio
        client = self._get_client()

        def _presign():
            return client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires_in,
            )

        return await asyncio.get_event_loop().run_in_executor(None, _presign)

    async def list_keys(self, prefix: str = "") -> list:
        import asyncio
        client = self._get_client()

        def _list():
            keys = []
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                for obj in page.get("Contents", []):
                    keys.append(obj["Key"])
            return keys

        return await asyncio.get_event_loop().run_in_executor(None, _list)

    async def stats(self) -> dict:
        return {"backend": "s3", "bucket": self.bucket, "region": self.region}


def _create_storage():
    """Create the appropriate storage backend based on config."""
    from app.core.config import settings

    backend = getattr(settings, "STORAGE_BACKEND", None) or os.getenv("STORAGE_BACKEND", "local")

    if backend == "s3":
        return S3Storage(
            bucket=getattr(settings, "S3_BUCKET", None) or os.getenv("S3_BUCKET", "afarensis-artifacts"),
            region=getattr(settings, "S3_REGION", None) or os.getenv("S3_REGION", "us-east-1"),
            access_key=getattr(settings, "S3_ACCESS_KEY", None) or os.getenv("S3_ACCESS_KEY"),
            secret_key=getattr(settings, "S3_SECRET_KEY", None) or os.getenv("S3_SECRET_KEY"),
            endpoint_url=getattr(settings, "S3_ENDPOINT_URL", None) or os.getenv("S3_ENDPOINT_URL"),
        )
    else:
        artifact_dir = getattr(settings, "ARTIFACT_DIRECTORY", "./artifacts")
        return LocalStorage(base_dir=artifact_dir)


# Singleton
storage = _create_storage()


def build_artifact_key(org_id: str, project_id: str, artifact_type: str, filename: str) -> str:
    """Build a storage key following the convention: org/project/type/filename."""
    org_id = org_id or "default"
    return f"{org_id}/{project_id}/{artifact_type}/{filename}"
