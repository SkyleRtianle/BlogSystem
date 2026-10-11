import mimetypes
import logging
import uuid
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException
from fastapi.responses import FileResponse, RedirectResponse, Response

from app.core.config import Settings, settings


IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def image_content_type(filename: str, content_type: str | None) -> str:
    value = content_type or mimetypes.guess_type(filename)[0] or ""
    if value not in IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG, WebP and GIF images are supported")
    return value


def photo_filename(owner_id: int, content_type: str) -> str:
    return f"{owner_id}_{uuid.uuid4().hex}{IMAGE_TYPES[content_type]}"


def safe_filename(filename: str) -> str:
    if not filename or filename in {".", ".."} or Path(filename).name != filename or "\\" in filename:
        raise HTTPException(status_code=404, detail="File not found")
    return filename


class LocalPhotoStorage:
    remote = False

    def __init__(self, configuration: Settings):
        self.directory = configuration.photo_upload_dir

    def put(self, filename: str, content: bytes, content_type: str) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        (self.directory / safe_filename(filename)).write_bytes(content)

    def response(self, filename: str) -> Response:
        path = self.directory / safe_filename(filename)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(path)

    def delete(self, filename: str) -> None:
        (self.directory / safe_filename(filename)).unlink(missing_ok=True)


class R2PhotoStorage:
    remote = True

    def __init__(self, configuration: Settings):
        configuration.validate_runtime()
        self.bucket = configuration.r2_bucket_name
        self.public_base_url = configuration.r2_public_base_url
        self.max_bytes = configuration.photo_max_bytes
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{configuration.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=configuration.r2_access_key_id,
            aws_secret_access_key=configuration.r2_secret_access_key,
            region_name="auto",
            config=Config(
                signature_version="s3v4",
                connect_timeout=10,
                read_timeout=20,
                retries={"max_attempts": 2},
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            ),
        )

    def _call(self, operation: str, **kwargs):
        try:
            return getattr(self.client, operation)(Bucket=self.bucket, **kwargs)
        except ClientError as error:
            if error.response["Error"]["Code"] in {"404", "NoSuchKey", "NotFound"}:
                raise HTTPException(status_code=404, detail="File not found") from error
            raise HTTPException(status_code=503, detail="Photo storage is temporarily unavailable") from error
        except BotoCoreError as error:
            raise HTTPException(status_code=503, detail="Photo storage is temporarily unavailable") from error

    def put(self, filename: str, content: bytes, content_type: str) -> None:
        self._call("put_object", Key=safe_filename(filename), Body=content, ContentType=content_type)

    def upload_url(self, filename: str, content_type: str) -> str:
        return self.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": safe_filename(filename), "ContentType": content_type},
            ExpiresIn=300,
        )

    def validate_upload(self, filename: str) -> None:
        info = self._call("head_object", Key=safe_filename(filename))
        if not 0 < info["ContentLength"] <= self.max_bytes:
            self.delete(filename)
            raise HTTPException(status_code=413, detail="Photo must be between 1 byte and 20 MiB")
        if info.get("ContentType") not in IMAGE_TYPES:
            self.delete(filename)
            raise HTTPException(status_code=415, detail="Unsupported image type")

    def response(self, filename: str) -> Response:
        filename = safe_filename(filename)
        self._call("head_object", Key=filename)
        url = (
            f"{self.public_base_url}/{quote(filename, safe='')}"
            if self.public_base_url
            else self.client.generate_presigned_url(
                "get_object", Params={"Bucket": self.bucket, "Key": filename}, ExpiresIn=300
            )
        )
        # Never cache a redirect to a URL that will expire.
        return RedirectResponse(url, status_code=307, headers={"Cache-Control": "no-store"})

    def delete(self, filename: str) -> None:
        self._call("delete_object", Key=safe_filename(filename))


@lru_cache
def get_photo_storage() -> LocalPhotoStorage | R2PhotoStorage:
    try:
        settings.validate_runtime()
    except RuntimeError as error:
        # Validation errors contain variable names, never credential values.
        logging.getLogger(__name__).warning("Photo storage configuration: %s", error)
        raise HTTPException(status_code=503, detail="Photo storage is not configured") from error
    return R2PhotoStorage(settings) if settings.photo_storage == "r2" else LocalPhotoStorage(settings)
