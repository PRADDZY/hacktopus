def build_payload():
    return {
        'avg_monthly_inflow': 95000,
        'inflow_volatility': 0.18,
        'avg_monthly_outflow': 52000,
        'min_balance_30d': 18000,
        'neg_balance_days_30d': 1,
        'purchase_to_inflow_ratio': 0.32,
        'total_burden_ratio': 0.48,
        'buffer_ratio': 0.19,
        'stress_index': 0.36,
    }


def test_health_endpoint(client_and_app):
    client, _ = client_and_app
    response = client.get('/health')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'ok'
    assert data['model_loaded'] is True
    assert isinstance(data['threshold'], float)


def test_stats_and_logs_empty(client_and_app):
    client, _ = client_and_app

    stats = client.get('/stats').json()
    assert stats['total_predictions'] == 0
    assert stats['approval_rate'] == 0.0
    assert stats['decline_rate'] == 0.0
    assert stats['risk_score_distribution'] == {'low': 0, 'medium': 0, 'high': 0}

    logs = client.get('/logs').json()
    assert logs['total'] == 0
    assert logs['items'] == []
    assert logs['total_pages'] == 1


def test_predict_uses_ml_service(client_and_app, monkeypatch):
    client, model_service = client_and_app
    monkeypatch.setattr(model_service, "_request_ml_service", lambda *_: 0.82)

    response = client.post('/predict', json=build_payload())
    assert response.status_code == 200
    data = response.json()
    assert data['risk_probability'] == 0.82
    assert data['decision'] == 'Decline'

    logs = client.get('/logs').json()
    assert logs['total'] == 1
    assert len(logs['items']) == 1


def test_predict_fallback_to_local_model(client_and_app, monkeypatch):
    client, model_service = client_and_app
    monkeypatch.setattr(model_service, "_request_ml_service", lambda *_: None)

    response = client.post('/predict', json=build_payload())
    assert response.status_code == 200
    data = response.json()
    assert data['risk_probability'] == 0.2
    assert data['decision'] == 'Approve'


def test_predict_validation_error(client_and_app):
    client, _ = client_and_app
    payload = build_payload()
    payload.pop('avg_monthly_inflow')

    response = client.post('/predict', json=payload)
    assert response.status_code == 422


def test_stats_and_logs_pagination(client_and_app, monkeypatch):
    client, model_service = client_and_app

    results = iter([0.1, 0.7, 0.4])
    monkeypatch.setattr(model_service, "_request_ml_service", lambda *_: next(results))

    for _ in range(3):
        response = client.post('/predict', json=build_payload())
        assert response.status_code == 200

    stats = client.get('/stats').json()
    assert stats['total_predictions'] == 3
    assert stats['risk_score_distribution'] == {'low': 1, 'medium': 1, 'high': 1}
    assert stats['approval_rate'] == 0.6667
    assert stats['decline_rate'] == 0.3333

    logs = client.get('/logs?limit=2').json()
    assert logs['total'] == 3
    assert logs['total_pages'] == 2
    assert len(logs['items']) == 2
