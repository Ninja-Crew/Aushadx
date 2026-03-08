import os
import requests
from langchain_core.tools import tool
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from utils.logger import logger
from dotenv import load_dotenv
from langchain_core.runnables import RunnableConfig
from datetime import datetime

load_dotenv()

MEDICINE_ANALYZER_URL = os.getenv("MEDICINE_ANALYZER_URL", "http://localhost:3002")
MEDICINE_SCHEDULER_URL = os.getenv("MEDICINE_SCHEDULER_URL", "http://localhost:3001")
PROFILE_MANAGER_URL = os.getenv("PROFILE_MANAGER_URL", "http://localhost:3003")

class GetUpcomingRemindersInput(BaseModel):
    pass # No inputs needed from LLM

@tool("get_upcoming_reminders", args_schema=GetUpcomingRemindersInput)
def get_upcoming_reminders(config: RunnableConfig) -> Dict[str, Any]:
    """Fetches specific scheduled reminders for the user."""
    user_id = config.get("configurable", {}).get("thread_id")
    try:
        url = f"{MEDICINE_SCHEDULER_URL}/reminders/{user_id}"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Error calling get_upcoming_reminders: {e}")
        return {"error": str(e)}

class GetPendingMissedRemindersInput(BaseModel):
    pass

@tool("get_pending_or_missed_reminders", args_schema=GetPendingMissedRemindersInput)
def get_pending_or_missed_reminders(config: RunnableConfig) -> List[Dict[str, Any]]:
    """Queries the database for any doses the user missed or still needs to take today."""
    user_id = config.get("configurable", {}).get("thread_id")
    try:
        url = f"{MEDICINE_SCHEDULER_URL}/reminders/missed/{user_id}"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Error calling get_pending_or_missed_reminders: {e}")
        return [{"error": str(e)}]

class AnalyzeMedicineInput(BaseModel):
    medicine_name: str = Field(description="The name of the medicine to analyze.")

@tool("analyze_medicine", args_schema=AnalyzeMedicineInput)
def analyze_medicine(medicine_name: str, config: RunnableConfig) -> Dict[str, Any]:
    """Takes the medicine name, fetches the profile, and formats potential complications."""
    user_id = config.get("configurable", {}).get("thread_id")
    try:
        url = f"{MEDICINE_ANALYZER_URL}/api/analyze/{user_id}"
        payload = {"medicine_data": {"text": medicine_name}}
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Error calling analyze_medicine: {e}")
        return {"error": str(e)}

class CheckMedicineTakenInput(BaseModel):
    medicine_name: str = Field(description="The name of the medicine to check.")

@tool("check_medicine_taken", args_schema=CheckMedicineTakenInput)
def check_medicine_taken(medicine_name: str, config: RunnableConfig) -> Dict[str, Any]:
    """Verifies the logs by getting pending/missed reminders and checking if the medicine is present."""
    missed_reminders = get_pending_or_missed_reminders.invoke({}, config=config)
    if isinstance(missed_reminders, list) and len(missed_reminders) > 0 and "error" in missed_reminders[0]:
        return {"error": missed_reminders[0]["error"]}

    # Filter for the specific medicine name
    for reminder in missed_reminders:
        if reminder.get("medicineName", "").lower() == medicine_name.lower():
            return {
                "medicine": medicine_name,
                "status": "pending_or_missed",
                "details": reminder
            }
    
    return {
        "medicine": medicine_name,
        "status": "taken_or_not_scheduled",
        "message": f"Could not find any pending or missed doses for {medicine_name}."
    }

class CheckScheduleComplicationsInput(BaseModel):
    pass

@tool("check_schedule_complications", args_schema=CheckScheduleComplicationsInput)
def check_schedule_complications(config: RunnableConfig) -> Dict[str, Any]:
    """A holistic check of all active reminders for the day to ensure taking them won't cause adverse interactions."""
    user_id = config.get("configurable", {}).get("thread_id")
    try:
        url = f"{MEDICINE_SCHEDULER_URL}/reminders/{user_id}"
        response = requests.get(url)
        response.raise_for_status()
        reminders = response.json()
        
        return {
            "active_reminders": reminders,
            "instruction": "Cross-reference these medications to ensure taking them at their scheduled times won't cause adverse drug interactions."
        }
    except requests.RequestException as e:
        logger.error(f"Error calling check_schedule_complications: {e}")
        return {"error": str(e)}

class ScheduleReminderInput(BaseModel):
    medicine_name: str = Field(description="Name of the medicine to schedule.")
    dosage: str = Field(description="Dosage instructions (e.g., '1 tablet', '500mg').")
    
    # Strictly enforce valid enums to avoid mongoose validation errors
    frequency: Literal[
        'ONCE', 
        'DAILY', 
        'X_TIMES_DAILY', 
        'EVERY_X_HOURS', 
        'EVERY_X_MINUTES', 
        'SPECIFIC_WEEK_DAYS', 
        'SPECIFIC_DAY_OF_MONTH',
        'AT_SPECIFIC_TIMINGS'
    ] = Field(description="Strict frequency type. MUST BE EXACTLY ONE OF the enum values. Example: if every 6 hours, use 'EVERY_X_HOURS'.", default="ONCE")
    
    frequencyValue: Optional[int] = Field(description="The numeric value 'X' for EVERY_X frequencies.", default=None)
    specificTimes: Optional[List[str]] = Field(description="A list of times to take the dose (e.g., ['08:00', '20:00']). Use for DAILY or ONCE.", default=None)
    
    duration: Literal[
        'SINGLE_DAY',
        'FOR_X_DAYS',
        'FOR_X_WEEKS',
        'FOR_X_MONTHS',
        'UNTIL_DATE',
        'CONTINUOUS'
    ] = Field(description="Strict duration type. MUST BE EXACTLY ONE OF the enum values.", default="CONTINUOUS")
    
    durationValue: Optional[int] = Field(description="The numeric value 'X' for FOR_X durations.", default=None)
    
    time: Optional[str] = Field(description="A single ISO datetime or HH:mm string. Required if frequency is ONCE.", default=None)
    startDate: Optional[str] = Field(description="ISO string representing when the reminder schedule begins (e.g. 2026-03-08T00:00:00Z).", default=None)

@tool("schedule_reminder", args_schema=ScheduleReminderInput)
def schedule_reminder(
    medicine_name: str, 
    dosage: str, 
    config: RunnableConfig,

    frequency: str = "ONCE",
    frequencyValue: Optional[int] = None,
    specificTimes: Optional[List[str]] = None,
    duration: str = "CONTINUOUS",
    durationValue: Optional[int] = None,
    time: Optional[str] = None,
    startDate: Optional[str] = None
) -> Dict[str, Any]:
    """Writes a new reminder to the database."""
    user_id = config.get("configurable", {}).get("thread_id")
    try:
        url = f"{MEDICINE_SCHEDULER_URL}/reminders/{user_id}"
        payload = {
            "medicineName": medicine_name,
            "dosage": dosage,
            "frequency": frequency,
            "duration": duration
        }
        
        # Add optional fields only if provided to prevent sending nulls confusing the db
        if frequencyValue is not None: payload["frequencyValue"] = frequencyValue
        if specificTimes is not None: payload["specificTimes"] = specificTimes
        if durationValue is not None: payload["durationValue"] = durationValue
        if time is not None: payload["time"] = time
        if startDate is not None: payload["startDate"] = startDate
        
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Error calling schedule_reminder: {e}")
        return {"error": str(e), "message": "Failed to schedule. Did you provide the exact ENUM literal values?"}

class GenerateMedicalSummaryInput(BaseModel):
    pass

@tool("generate_medical_summary", args_schema=GenerateMedicalSummaryInput)
def generate_medical_summary(config: RunnableConfig) -> Dict[str, Any]:
    """Generates a medical and clinical summary of the user by getting medications and medical info."""
    user_id = config.get("configurable", {}).get("thread_id")
    result = {}
    
    try:
        url = f"{PROFILE_MANAGER_URL}/profile/medical-info/{user_id}"
        response = requests.get(url)
        if response.ok:
            data = response.json()
            if data.get("success"):
                result["medical_info"] = data.get("data", {}).get("profile", {}).get("medicalInfo", {})
            else:
                 result["medical_info"] = data
        else:
            result["medical_info_error"] = f"Status: {response.status_code}"
    except requests.RequestException as e:
        result["medical_info_error"] = str(e)

    try:
        url = f"{MEDICINE_SCHEDULER_URL}/reminders/{user_id}"
        response = requests.get(url)
        if response.ok:
            result["medications"] = response.json()
        else:
            result["medications_error"] = f"Status: {response.status_code}"
    except requests.RequestException as e:
        result["medications_error"] = str(e)
        
    result["instruction"] = "Analyze this user's medications and medical info to generate a complete clinical summary."
    return result

@tool("get_current_datetime")
def get_current_datetime() -> str:
    """Returns the current precise date and time in ISO format for scheduling and context."""
    return datetime.now().isoformat()

tools = [
    get_upcoming_reminders,
    get_pending_or_missed_reminders,
    analyze_medicine,
    check_medicine_taken,
    check_schedule_complications,
    schedule_reminder,
    generate_medical_summary,
    get_current_datetime,
]

core_tools = tools.copy()
