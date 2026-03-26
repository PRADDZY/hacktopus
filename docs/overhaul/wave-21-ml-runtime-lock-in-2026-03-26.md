# Wave 21: ML Runtime Lock-In Controls

Date: 2026-03-26

## Implemented

- Added explicit ML runtime mode selection in inference service:
  - `MODEL_RUNTIME_MODE=auto|dual_target|ensemble|single_model`
- Added strict startup validation for each mode to prevent ambiguous artifact fallback behavior.
- Disabled legacy XGBoost JSON fallback by default in `auto` mode.
- Added opt-in toggle for legacy JSON fallback:
  - `ML_LEGACY_JSON_FALLBACK_ENABLED=true`
- Added tests for runtime mode parsing/validation behavior.
- Updated root docs with ML runtime configuration variables.

## Updated Files

- `ml-service/main.py`
- `ml-service/tests/test_service.py`
- `README.md`

## Verification

- `ml-service`: `python -m pytest -q` -> pass

