
def build_payload():
    return {
        'avg_monthly_inflow': 100000,
        'inflow_volatility': 0.2,
        'avg_monthly_outflow': 55000,
        'min_balance_30d': 15000,
        'neg_balance_days_30d': 2,
        'purchase_to_inflow_ratio': 0.3,
        'total_burden_ratio': 0.5,
        'buffer_ratio': 0.15,
        'stress_index': 0.4,
    }


def test_health_and_metadata(client_and_app):
    client, _ = client_and_app

    health = client.get('/health')
    assert health.status_code == 200
    assert health.json() == {'status': 'ok', 'model_loaded': True}

    metadata = client.get('/metadata')
    assert metadata.status_code == 200
    data = metadata.json()
    assert isinstance(data['threshold'], float)
    assert isinstance(data['feature_columns'], list)
    assert len(data['feature_columns']) == 9


def test_predict_returns_probability(client_and_app):
    client, _ = client_and_app

    response = client.post('/predict', json=build_payload())
    assert response.status_code == 200
    data = response.json()
    assert data['risk_probability'] == 0.23
    assert data['model_source'] == 'pkl'


def test_predict_validation_error_missing_field(client_and_app):
    client, _ = client_and_app
    payload = build_payload()
    payload.pop('avg_monthly_inflow')

    response = client.post('/predict', json=payload)
    assert response.status_code == 422


def test_missing_feature_columns_returns_500(client_and_app):
    client, ml_main = client_and_app

    original = list(ml_main.app.state.feature_columns)
    ml_main.app.state.feature_columns = original + ['missing_feature']

    response = client.post('/predict', json=build_payload())
    assert response.status_code == 500

    ml_main.app.state.feature_columns = original
