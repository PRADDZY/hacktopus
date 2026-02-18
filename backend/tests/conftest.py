from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

TEST_DB_PATH = Path(tempfile.gettempdir()) / 'fairlens_test.db'
os.environ.setdefault('DATABASE_URL', f"sqlite:///{TEST_DB_PATH}")

import database
import main
from app.services import model_service


class StubModel:
    def __init__(self, probability: float = 0.2) -> None:
        self.probability = probability

    def predict_proba(self, dataframe):
        return [[1 - self.probability, self.probability]]


@pytest.fixture()
def client_and_app(monkeypatch):
    database.Base.metadata.drop_all(bind=database.engine)
    database.Base.metadata.create_all(bind=database.engine)

    monkeypatch.setattr(model_service.joblib, 'load', lambda *_: StubModel(probability=0.2))

    with TestClient(main.app) as client:
        yield client, model_service
