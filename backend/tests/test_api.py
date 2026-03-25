def build_payload():
    return {
        'segment': 'gig_worker',
        'monthly_inflow': 95000,
        'monthly_outflow': 52000,
        'inflow_volatility_90d': 0.18,
        'outflow_volatility_90d': 0.2,
        'deposit_count_30d': 7,
        'days_since_last_income': 3,
        'avg_balance_30d': 26000,
        'min_balance_30d': 18000,
        'negative_balance_days_30d': 1,
        'essential_spend_ratio': 0.62,
        'active_loan_count': 1,
        'monthly_installment_burden': 9000,
        'purchase_amount': 30000,
        'tenure_weeks': 24,
        'purchase_to_inflow_ratio': 0.32,
        'installment_to_inflow_ratio': 0.095,
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
    monkeypatch.setattr(
        model_service,
        "_request_ml_service",
        lambda *_args, **_kwargs: {
            "risk_probability": 0.82,
            "decision": "Decline",
            "model_version": "ensemble-catboost-ft-v1",
            "schema_version": "risk-v2.0.0",
            "calibration_bucket": "very_high",
            "reasons": [
                {
                    "code": "HIGH_TOTAL_BURDEN",
                    "feature": "total_burden_ratio",
                    "direction": "up",
                    "impact": 0.22,
                    "message": "High burden"
                }
            ]
        },
    )

    response = client.post('/predict', json=build_payload())
    assert response.status_code == 200
    data = response.json()
    assert data['risk_probability'] == 0.82
    assert data['decision'] == 'Decline'
    assert data['model_version'] == 'ensemble-catboost-ft-v1'
    assert data['schema_version'] == 'risk-v2.0.0'
    assert data['calibration_bucket'] == 'very_high'
    assert len(data['reasons']) >= 1

    logs = client.get('/logs').json()
    assert logs['total'] == 1
    assert len(logs['items']) == 1


def test_predict_fallback_to_local_model(client_and_app, monkeypatch):
    client, model_service = client_and_app
    monkeypatch.setattr(model_service, "_request_ml_service", lambda *_, **__: None)

    response = client.post('/predict', json=build_payload())
    assert response.status_code == 200
    data = response.json()
    assert data['risk_probability'] == 0.2
    assert data['decision'] == 'Approve'
    assert data['schema_version'] == 'risk-v2.0.0'
    assert len(data['reasons']) >= 1


def test_predict_validation_error(client_and_app):
    client, _ = client_and_app
    payload = build_payload()
    payload.pop('monthly_inflow')

    response = client.post('/predict', json=payload)
    assert response.status_code == 422


def test_stats_and_logs_pagination(client_and_app, monkeypatch):
    client, model_service = client_and_app

    results = iter([0.1, 0.7, 0.4])
    monkeypatch.setattr(model_service, "_request_ml_service", lambda *_, **__: next(results))

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
