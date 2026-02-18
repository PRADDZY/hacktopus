from __future__ import annotations

import importlib.util
import os
import socket
import threading
import time
from pathlib import Path

import httpx
import uvicorn
from fastapi.testclient import TestClient

import database
import main as backend_main


class StubModel:
    def __init__(self, probability: float) -> None:
        self.probability = probability

    def predict_proba(self, dataframe):
        return [[1 - self.probability, self.probability]]


def _load_ml_service_module():
    repo_root = Path(__file__).resolve().parents[3]
    ml_service_path = repo_root / 'ml-service' / 'main.py'
    spec = importlib.util.spec_from_file_location('ml_service_main', ml_service_path)
    if spec is None or spec.loader is None:
        raise RuntimeError('Unable to load ml-service main module')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _get_free_port() -> int:
    sock = socket.socket()
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


def _wait_for_health(port: int, timeout: float = 6.0) -> bool:
    deadline = time.time() + timeout
    url = f'http://127.0.0.1:{port}/health'
    while time.time() < deadline:
        try:
            response = httpx.get(url, timeout=1.0)
            if response.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.1)
    return False


def _build_payload():
    return {
        'avg_monthly_inflow': 88000,
        'inflow_volatility': 0.21,
        'avg_monthly_outflow': 51000,
        'min_balance_30d': 15000,
        'neg_balance_days_30d': 2,
        'purchase_to_inflow_ratio': 0.33,
        'total_burden_ratio': 0.52,
        'buffer_ratio': 0.17,
        'stress_index': 0.43,
    }


def test_predict_chain_uses_ml_service():
    ml_main = _load_ml_service_module()
    stub_probability = 0.73
    ml_main.joblib.load = lambda *_: StubModel(stub_probability)

    port = _get_free_port()

    repo_root = Path(__file__).resolve().parents[3]
    model_path = repo_root / 'ml-service' / 'bnpl_cashflow_model.pkl'
    os.environ['MODEL_PATH'] = str(model_path)

    config = uvicorn.Config(ml_main.app, host='127.0.0.1', port=port, log_level='error')
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    assert _wait_for_health(port), 'ML service failed to start'

    os.environ.pop('MODEL_PATH', None)
    os.environ['ML_SERVICE_URL'] = f'http://127.0.0.1:{port}'
    os.environ['ML_SERVICE_TIMEOUT'] = '5'

    database.Base.metadata.drop_all(bind=database.engine)
    database.Base.metadata.create_all(bind=database.engine)

    try:
        with TestClient(backend_main.app) as client:
            response = client.post('/predict', json=_build_payload())
            assert response.status_code == 200
            data = response.json()
            assert data['risk_probability'] == stub_probability
            assert data['decision'] == 'Decline'

            logs = client.get('/logs').json()
            assert logs['total'] == 1
    finally:
        server.should_exit = True
        thread.join(timeout=5)
