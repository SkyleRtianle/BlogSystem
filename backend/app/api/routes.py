from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/site")
async def site_info() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "env": settings.app_env,
    }
