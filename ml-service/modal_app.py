import os

import modal

RUNTIME_ENV_KEYS = [
    "MODEL_RUNTIME_MODE",
    "MODEL_PATH",
    "MODEL_METADATA_PATH",
    "MODEL_ARTIFACT_DIR",
    "ML_LEGACY_JSON_FALLBACK_ENABLED",
    "EXTRACTION_CALLBACK_BASE_URL",
    "EXTRACTION_CALLBACK_SECRET",
    "EXTRACTION_CALLBACK_TIMEOUT_SECONDS",
]

runtime_env = {
    key: value
    for key in RUNTIME_ENV_KEYS
    if (value := os.getenv(key))
}

image = modal.Image.debian_slim(python_version="3.11").pip_install_from_requirements(
    "requirements.txt"
)

app = modal.App("fairlens-ml-api")


@app.function(
    image=image,
    env=runtime_env,
    timeout=600,
)
@modal.asgi_app()
def api():
    from main import app as fastapi_app

    return fastapi_app
