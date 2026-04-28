import logging
from urllib.parse import urlparse

import aioboto3
from botocore.config import Config
from fastapi import UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)

_session = aioboto3.Session()


def _get_s3_client():
    """Return a context-manager-based async S3 client pointed at Supabase Storage."""
    return _session.client(
        "s3",
        endpoint_url=settings.SUPABASE_S3_ENDPOINT,
        aws_access_key_id=settings.SUPABASE_S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.SUPABASE_S3_SECRET_ACCESS_KEY,
        region_name=settings.SUPABASE_S3_REGION,
        config=Config(signature_version="s3v4"),
    )


def _build_public_url(bucket: str, key: str) -> str:
    """Build the Supabase public storage URL for a given bucket + key."""
    parsed = urlparse(settings.SUPABASE_URL)
    base = f"{parsed.scheme}://{parsed.netloc}"
    return f"{base}/storage/v1/object/public/{bucket}/{key}"


def extract_bucket_and_key(public_url: str) -> tuple[str, str]:
    """Parse (bucket, key) out of a Supabase public storage URL.

    Args:
        public_url: URL in the form
            {SUPABASE_URL}/storage/v1/object/public/{bucket}/{key}

    Returns:
        Tuple of (bucket, key).
    """
    parsed = urlparse(settings.SUPABASE_URL)
    base = f"{parsed.scheme}://{parsed.netloc}"
    prefix = f"{base}/storage/v1/object/public/"
    remainder = public_url.removeprefix(prefix)
    bucket, _, key = remainder.partition("/")
    return bucket, key


async def upload_bytes(
    bucket: str,
    key: str,
    data: bytes,
    content_type: str,
) -> str:
    """Upload raw bytes to Supabase Storage and return the public URL.

    Args:
        bucket: Target bucket name (e.g. "uploads").
        key: Object key / path inside the bucket.
        data: Raw file bytes.
        content_type: MIME type string (e.g. "image/jpeg").

    Returns:
        Public URL of the uploaded object.

    Raises:
        Exception: Propagates any S3 client errors.
    """
    async with _get_s3_client() as s3:
        await s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
    url = _build_public_url(bucket, key)
    logger.info("Uploaded %d bytes → %s/%s", len(data), bucket, key)
    return url


async def upload_file(bucket: str, key: str, file: UploadFile) -> str:
    """Upload a FastAPI UploadFile to Supabase Storage and return the public URL.

    The caller is responsible for reading-position / size validation before
    calling this function.

    Args:
        bucket: Target bucket name.
        key: Object key inside the bucket.
        file: FastAPI UploadFile instance (must not have been read yet).

    Returns:
        Public URL of the uploaded object.
    """
    data = await file.read()
    content_type = file.content_type or "application/octet-stream"
    return await upload_bytes(bucket, key, data, content_type)


async def delete_object(bucket: str, key: str) -> None:
    """Delete an object from Supabase Storage.

    Args:
        bucket: Bucket containing the object.
        key: Object key to delete.
    """
    async with _get_s3_client() as s3:
        await s3.delete_object(Bucket=bucket, Key=key)
    logger.info("Deleted %s/%s", bucket, key)
