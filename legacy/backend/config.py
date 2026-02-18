
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "FinTech Risk Bridge API"
    VERSION: str = "1.0.0"
    
    # ML Model Service URL (your teammate's ML endpoint)
    ML_SERVICE_URL: str = "http://localhost:5000"  # Change to your ML service URL
    
    # Database
    DATABASE_URL: str = "sqlite:///./fintech_risk.db"
    
    # CORS - Allow frontend origins
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",      # React default
        "http://localhost:5173",      # Vite default
        "http://localhost:8080",      # Vue default
        "http://localhost:4200",      # Angular default
    ]
    
    # Timeouts
    ML_REQUEST_TIMEOUT: int = 30  # seconds
    
    class Config:
        env_file = ".env"

settings = Settings()