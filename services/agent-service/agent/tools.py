import os
import requests
import json
from langchain_core.tools import tool
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from utils.logger import logger
from dotenv import load_dotenv

load_dotenv()

MEDICINE_ANALYZER_URL = os.getenv("MEDICINE_ANALYZER_URL", "http://localhost:3002")
MEDICINE_SCHEDULER_URL = os.getenv("MEDICINE_SCHEDULER_URL", "http://localhost:3001")
PROFILE_MANAGER_URL = os.getenv("PROFILE_MANAGER_URL", "http://localhost:3003")

class MedicineAnalysisInput(BaseModel):
    text: str = Field(description="The text content or OCR result to be analyzed for medicine details.")
    user_id: str = Field(description="The unique identifier of the user.")

@tool("analyze_medicine", args_schema=MedicineAnalysisInput)
def analyze_medicine(text: str, user_id: str) -> Dict[str, Any]:
    """
    Analyzes raw text or OCR data to extract structured medicine information.
    
    Use this tool when you have raw text describing a medicine (e.g., from a label) and need to understand:
    - Drug name
    - Dosage information
    - Side effects
    - Warnings/Contraindications
    
    Returns a JSON object with the extracted details.
    """
    try:
        url = f"{MEDICINE_ANALYZER_URL}/analyze"
        payload = {"medicine_data": {"text": text}, "userId": user_id}
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Error calling analyze_medicine: {e}")
        return {"error": str(e), "message": "Failed to analyze medicine text."}

class GetMedicineDetailsInput(BaseModel):
    medicine_name: str = Field(description="The name of the medicine to retrieve details for.")
    user_id: str = Field(description="The unique identifier of the user.")

@tool("get_medicine_details", args_schema=GetMedicineDetailsInput)
def get_medicine_details(medicine_name: str, user_id: str) -> Dict[str, Any]:
    """
    Retrieves detailed information about a specific medicine by name.
    
    Use this tool when the user asks about a specific drug (e.g., 'Tell me about Paracetamol') 
    without providing raw text/OCR data.
    """
    # Note: Assuming medicine-analyzer has a search or detail endpoint. 
    # If not, we might reuse `analyze` with synthesized text or query a different endpoint.
    # For now, let's assume we send it to analyze to get general knowledge or RAG info.
    return analyze_medicine.invoke({"text": f"Information about {medicine_name}", "user_id": user_id})

class ScheduleMedicineInput(BaseModel):
    user_id: str = Field(description="The unique identifier of the user.")
    medicine_name: str = Field(description="Name of the medicine to schedule.")
    dosage: str = Field(description="Dosage instructions (e.g., '500mg', '1 tablet').")
    frequency: str = Field(description="How often to take the medicine (e.g., 'daily', 'weekly', 'twice a day').")
    time: str = Field(description="The time to take the medicine (e.g., '09:00 AM').")
    start_date: Optional[str] = Field(description="Start date in YYYY-MM-DD format.", default=None)
    end_date: Optional[str] = Field(description="End date in YYYY-MM-DD format.", default=None)

@tool("schedule_medicine", args_schema=ScheduleMedicineInput)
def schedule_medicine(user_id: str, medicine_name: str, dosage: str, frequency: str, time: str, start_date: str = None, end_date: str = None) -> Dict[str, Any]:
    """
    Schedules a medicine reminder for a user.
    
    Use this tool when the user explicitly asks to set a reminder or schedule a medicine.
    Requires specific details: name, dosage, frequency, and time.
    """
    try:
        url = f"{MEDICINE_SCHEDULER_URL}/reminders"
        payload = {
            "userId": user_id,
            "medicineName": medicine_name,
            "dosage": dosage,
            "schedule": {
                "frequency": frequency,
                "time": time,
                "startDate": start_date,
                "endDate": end_date
            }
        }
        # Clean up None values
        payload = {k: v for k, v in payload.items() if v is not None}
        if "schedule" in payload:
             payload["schedule"] = {k: v for k, v in payload["schedule"].items() if v is not None}

        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Error calling schedule_medicine: {e}")
        return {"error": str(e), "message": "Failed to schedule medicine."}

class GetRemindersInput(BaseModel):
    user_id: str = Field(description="The unique identifier of the user.")

@tool("get_reminders", args_schema=GetRemindersInput)
def get_reminders(user_id: str) -> Dict[str, Any]:
    """
    Retrieves the list of active medicine reminders for a user.
    
    Use this tool when a user asks 'What are my medicines?' or 'What reminders do I have?'.
    """
    try:
        url = f"{MEDICINE_SCHEDULER_URL}/reminders/user/{user_id}"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Error calling get_reminders: {e}")
        return {"error": str(e), "message": "Failed to fetch reminders."}

class GetMedicalProfileInput(BaseModel):
    user_id: str = Field(description="The unique identifier of the user.")

@tool("get_medical_profile", args_schema=GetMedicalProfileInput)
def get_medical_profile(user_id: str) -> Dict[str, Any]:
    """
    Retrieves the user's medical profile, including history, allergies, and conditions.
    
    Use this tool to contextually understand the user's health background, 
    especially when analyzing symptoms or checking for contraindications.
    """
    try:
        url = f"{PROFILE_MANAGER_URL}/profile/{user_id}/medical-info"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Error calling get_medical_profile: {e}")
        return {"error": str(e), "message": "Failed to fetch medical profile."}

# List of tools to be bound to the agent
tools = [
    analyze_medicine,
    get_medicine_details,
    schedule_medicine,
    get_reminders,
    get_medical_profile
]
