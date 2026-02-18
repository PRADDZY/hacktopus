from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

_MODULE_PATH = Path(__file__).resolve().parent.parent / "database.py"
_SPEC = spec_from_file_location("fairlens_database_file", _MODULE_PATH)
if _SPEC is None or _SPEC.loader is None:
    raise RuntimeError(f"Unable to load database module from {_MODULE_PATH}")

_MODULE = module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

DATABASE_URL = _MODULE.DATABASE_URL
Base = _MODULE.Base
SessionLocal = _MODULE.SessionLocal
engine = _MODULE.engine
get_db = _MODULE.get_db
