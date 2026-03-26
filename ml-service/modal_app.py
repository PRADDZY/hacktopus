import os
from pathlib import Path

import modal

PROJECT_ROOT = Path(__file__).resolve().parent

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

REQUIRED_DEPLOY_FILES = [
    "main.py",
    "model_metadata.json",
    "bnpl_cashflow_model.pkl",
    "gig_bnpl_xgb_model.json",
]

image = modal.Image.debian_slim(python_version="3.11").pip_install_from_requirements(
    "requirements.txt"
)
for file_name in REQUIRED_DEPLOY_FILES:
    local_path = PROJECT_ROOT / file_name
    if local_path.exists():
        image = image.add_local_file(str(local_path), f"/root/{file_name}")

app = modal.App("fairlens-ml-api")


@app.function(
    image=image,
    env=runtime_env,
    timeout=600,
    include_source=True,
)
@modal.asgi_app()
def api():
    from main import app as fastapi_app

    return fastapi_app
