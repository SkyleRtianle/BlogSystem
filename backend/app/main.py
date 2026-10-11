from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.music_routes import router as music_router
from app.api.public_routes import router as public_router
from app.api.routes import router as api_router
from app.core.config import settings
from app.db.session import init_db


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings.validate_runtime()
    init_db()
    yield


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
        docs_url=f"{settings.api_prefix}/docs",
        swagger_ui_oauth2_redirect_url=f"{settings.api_prefix}/docs/oauth2-redirect",
        redoc_url=f"{settings.api_prefix}/redoc",
        openapi_url=f"{settings.api_prefix}/openapi.json",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router, prefix=settings.api_prefix)
    application.include_router(music_router, prefix=settings.api_prefix)
    application.include_router(public_router, prefix=settings.api_prefix)

    @application.get("/")
    async def root() -> dict[str, str]:
        return {"message": f"{settings.app_name} API is running"}

    return application


app = create_app()
