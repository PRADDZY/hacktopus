import requests
import httpx
from typing import Dict, Tuple
from config import settings
from models.schemas import MLModelRequest, MLModelResponse

class MLServiceConnector:
    """
    Connector to communicate with ML Model Service
    YOUR TEAMMATE provides the ML endpoint
    """
    
    def __init__(self):
        self.ml_url = settings.ML_SERVICE_URL
        self.timeout = settings.ML_REQUEST_TIMEOUT
    
    async def predict(self, ml_request: MLModelRequest) -> MLModelResponse:
        """
        Send request to ML service and get prediction
        
        OPTION 1: If your ML teammate provides a REST API endpoint
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.ml_url}/predict",  # Your ML teammate's endpoint
                    json=ml_request.dict(),
                    timeout=self.timeout
                )
                response.raise_for_status()
                
                # Parse ML response
                ml_data = response.json()
                return MLModelResponse(**ml_data)
        
        except httpx.TimeoutException:
            raise Exception("ML service timeout")
        except httpx.HTTPError as e:
            raise Exception(f"ML service error: {str(e)}")
        except Exception as e:
            raise Exception(f"Error calling ML service: {str(e)}")
    
    def predict_sync(self, ml_request: MLModelRequest) -> MLModelResponse:
        """
        OPTION 2: Synchronous version (if you prefer sync over async)
        """
        try:
            response = requests.post(
                f"{self.ml_url}/predict",
                json=ml_request.dict(),
                timeout=self.timeout
            )
            response.raise_for_status()
            
            ml_data = response.json()
            return MLModelResponse(**ml_data)
        
        except requests.Timeout:
            raise Exception("ML service timeout")
        except requests.HTTPError as e:
            raise Exception(f"ML service error: {str(e)}")
        except Exception as e:
            raise Exception(f"Error calling ML service: {str(e)}")
    
    def predict_local(self, ml_request: MLModelRequest) -> MLModelResponse:
        """
        OPTION 3: If your ML teammate provides a Python function/class
        Import their model and call directly
        """
        try:
            # Example: Import your teammate's ML model
            # from ml_model import RiskModel  # Your teammate's code
            # model = RiskModel()
            # result = model.predict(ml_request.dict())
            
            # For now, return a mock response
            # REPLACE THIS with actual ML model call
            return MLModelResponse(
                risk_score=0.35,
                risk_category="Moderate",
                feature_importance={
                    "credit_score": 0.30,
                    "dti_ratio": 0.35,
                    "foir": 0.20,
                    "savings_months": 0.10,
                    "emi_tenure_months": 0.05
                }
            )
        
        except Exception as e:
            raise Exception(f"Error in local ML prediction: {str(e)}")
    
    async def health_check(self) -> bool:
        """
        Check if ML service is healthy
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.ml_url}/health",
                    timeout=5
                )
                return response.status_code == 200
        except:
            return False

# Singleton instance
ml_connector = MLServiceConnector()