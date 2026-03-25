
class ConstantProbModel:
    def __init__(self, probability: float) -> None:
        self.probability = probability

    def predict_proba(self, dataframe):  # noqa: ARG002
        return [[1 - self.probability, self.probability]]


def build_payload():
    return {
        'segment': 'gig_worker',
        'monthly_inflow': 100000,
        'monthly_outflow': 55000,
        'inflow_volatility_90d': 0.2,
        'outflow_volatility_90d': 0.24,
        'deposit_count_30d': 6,
        'days_since_last_income': 2,
        'avg_balance_30d': 22000,
        'min_balance_30d': 15000,
        'negative_balance_days_30d': 2,
        'essential_spend_ratio': 0.62,
        'active_loan_count': 1,
        'monthly_installment_burden': 8000,
        'purchase_amount': 32000,
        'tenure_weeks': 24,
        'purchase_to_inflow_ratio': 0.3,
        'installment_to_inflow_ratio': 0.08,
        'total_burden_ratio': 0.5,
        'buffer_ratio': 0.15,
        'stress_index': 0.4,
    }


def test_health_and_metadata(client_and_app):
    client, _ = client_and_app

    health = client.get('/health')
    assert health.status_code == 200
    health_data = health.json()
    assert health_data['status'] == 'ok'
    assert health_data['model_loaded'] is True
    assert health_data['model_version']

    metadata = client.get('/metadata')
    assert metadata.status_code == 200
    data = metadata.json()
    assert isinstance(data['threshold'], float)
    assert data['schema_version'] == 'risk-v2.0.0'
    assert data['model_version']
    assert isinstance(data['required_features'], list)
    assert len(data['required_features']) >= 20
    assert isinstance(data['reason_code_catalog'], list)


def test_predict_returns_probability(client_and_app):
    client, _ = client_and_app

    response = client.post('/predict', json=build_payload())
    assert response.status_code == 200
    data = response.json()
    assert data['risk_probability'] == 0.23
    assert data['model_source'] == 'pkl'
    assert data['schema_version'] == 'risk-v2.0.0'
    assert data['model_version']
    assert isinstance(data['reasons'], list)
    assert len(data['reasons']) >= 1
    assert data['calibration_bucket'] in {'very_low', 'low', 'medium', 'high', 'very_high'}


def test_predict_validation_error_missing_field(client_and_app):
    client, _ = client_and_app
    payload = build_payload()
    payload.pop('monthly_inflow')

    response = client.post('/predict', json=payload)
    assert response.status_code == 422


def test_missing_feature_columns_returns_500(client_and_app):
    client, ml_main = client_and_app

    original = list(ml_main.app.state.model_feature_columns)
    ml_main.app.state.model_feature_columns = original + ['missing_feature']

    response = client.post('/predict', json=build_payload())
    assert response.status_code == 500

    ml_main.app.state.model_feature_columns = original


def test_featureize_statement_returns_risk_v2_features(client_and_app):
    client, _ = client_and_app

    response = client.post(
        '/featureize/statement',
        json={
            'segment': 'gig_worker',
            'purchase_amount': 32000,
            'tenure_weeks': 24,
            'statement_window_days': 90,
            'transactions': [
                {'date': '2026-03-01', 'amount': 52000, 'direction': 'credit', 'balance': 8100},
                {'date': '2026-03-03', 'amount': -11200, 'direction': 'debit', 'balance': 6200},
                {'date': '2026-02-16', 'amount': -8400, 'direction': 'debit', 'balance': 3200},
                {'date': '2026-02-10', 'amount': 18000, 'direction': 'credit', 'balance': 11400},
                {'date': '2026-01-24', 'amount': -9700, 'direction': 'debit', 'balance': -400},
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data['schema_version'] == 'risk-v2.0.0'
    assert data['feature_schema_version'] == 'statement-feature-v1'
    features = data['features']
    assert features['segment'] == 'gig_worker'
    assert features['monthly_inflow'] > 0
    assert features['monthly_outflow'] >= 0
    assert features['deposit_count_30d'] >= 0
    assert features['days_since_last_income'] >= 0
    assert 'stress_index' in features


def test_predict_uses_dual_target_bundle_when_available(client_and_app):
    client, ml_main = client_and_app
    ml_main.app.state.model = None
    ml_main.app.state.model_source = 'dual_target'
    ml_main.app.state.dual_target_bundle = {
        'primary_model': ConstantProbModel(0.8),
        'secondary_model': ConstantProbModel(0.2),
        'primary_calibrator': None,
        'secondary_calibrator': None,
        'weight_primary': 0.7,
        'weight_secondary': 0.3,
    }

    response = client.post('/predict', json=build_payload())
    assert response.status_code == 200
    data = response.json()
    assert data['model_source'] == 'dual_target'
    assert data['risk_probability'] == 0.62
