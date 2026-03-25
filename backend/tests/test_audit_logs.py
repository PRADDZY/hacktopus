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


def test_audit_logs_empty(client_and_app):
    client, _ = client_and_app
    response = client.get('/audit-logs')
    assert response.status_code == 200
    data = response.json()
    assert data['total'] == 0
    assert data['items'] == []
    assert data['total_pages'] == 1


def test_audit_logs_created_on_predict(client_and_app, monkeypatch):
    client, model_service = client_and_app
    monkeypatch.setattr(model_service, "_request_ml_service", lambda *_, **__: 0.82)

    response = client.post('/predict', json=build_payload())
    assert response.status_code == 200

    logs = client.get('/audit-logs').json()
    assert logs['total'] == 1
    item = logs['items'][0]
    assert item['status'] == 'success'
    assert item['source'] == 'ml_service'
    assert item['action'] == 'Risk decision'


def test_audit_logs_filter_and_search(client_and_app, monkeypatch):
    client, model_service = client_and_app
    monkeypatch.setattr(model_service, "_request_ml_service", lambda *_, **__: None)

    response = client.post('/predict', json=build_payload())
    assert response.status_code == 200

    warning_logs = client.get('/audit-logs?status=warning').json()
    assert warning_logs['total'] == 1
    assert warning_logs['items'][0]['status'] == 'warning'

    search_logs = client.get('/audit-logs?search=Risk').json()
    assert search_logs['total'] == 1
