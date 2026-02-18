from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401
from .api import router as api_router
from .core import Base, engine, get_settings
from .services import ModelService


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    settings = get_settings()
    model_service = ModelService.from_settings(settings)

    app.state.model_service = model_service
    app.state.threshold = float(model_service.threshold)
    app.state.settings = settings

    yield


settings = get_settings()

app = FastAPI(
    title="FairLens API",
    description="BNPL risk scoring backend for checkout and bank analytics dashboard.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
