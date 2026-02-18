import importlib

import pytest
from fastapi.testclient import TestClient


class StubModel:
    def __init__(self, probability: float = 0.23) -> None:
        self.probability = probability

    def predict_proba(self, dataframe):
        return [[1 - self.probability, self.probability]]


@pytest.fixture()
def client_and_app(monkeypatch):
    import main as ml_main
    importlib.reload(ml_main)

    monkeypatch.setattr(ml_main.joblib, 'load', lambda *_: StubModel(probability=0.23))

    with TestClient(ml_main.app) as client:
        yield client, ml_main