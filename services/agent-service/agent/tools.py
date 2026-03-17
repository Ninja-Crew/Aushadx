import os
import requests
from langchain_core.tools import tool
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from utils.logger import logger
from dotenv import load_dotenv
from langchain_core.runnables import RunnableConfig
from datetime import datetime, timezone, timedelta
import zoneinfo
import re
import logging

load_dotenv()

MEDICINE_ANALYZER_URL = os.getenv("MEDICINE_ANALYZER_URL", "http://localhost:3002")
MEDICINE_SCHEDULER_URL = os.getenv("MEDICINE_SCHEDULER_URL", "http://localhost:3001")
PROFILE_MANAGER_URL = os.getenv("PROFILE_MANAGER_URL", "http://localhost:3003")

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def parse_time_str(time_str: str):
    """Parses a time string like '09:00', '9:00 AM', '09:00:00' into 24-hour ints."""
    time_str = time_str.strip().upper()
    match = re.search(r"(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?", time_str)
    if not match:
        raise ValueError(f"Invalid time format: {time_str}")
    
    hours = int(match.group(1))
    minutes = int(match.group(2))
    period = match.group(3)
    
    if period == "PM" and hours < 12:
        hours += 12
    elif period == "AM" and hours == 12:
        hours = 0
        
    return hours, minutes

def get_client_tz(config: RunnableConfig):
    """Securely resolves exactly which timezone to assign based on numeric JS offset prioritizing."""
    client_timezone = config.get("configurable", {}).get("client_timezone", "UTC")
    client_tz_offset = config.get("configurable", {}).get("client_tz_offset")
    
    # Try exact numerical JS offset first (most reliable)
    if client_tz_offset is not None:
        try:
            offset_mins = int(client_tz_offset)
            # JS getTimezoneOffset() gives (UTC - Local). Python needs (Local - UTC). Negate it:
            return timezone(timedelta(minutes=-offset_mins))
        except ValueError:
            pass
            
    # Fallback to pure IANA string parsing
    try:
        return zoneinfo.ZoneInfo(client_timezone)
    except Exception:
        return timezone.utc

class GetUpcomingRemindersInput(BaseModel):
    pass # No inputs needed from LLM

@tool("get_upcoming_reminders", args_schema=GetUpcomingRemindersInput)
def get_upcoming_reminders(config: RunnableConfig) -> Dict[str, Any]:
    """Fetches specific scheduled reminders for the user."""
    user_id = config.get("configurable", {}).get("user_id") or config.get("configurable", {}).get("thread_id")
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
    user_id = config.get("configurable", {}).get("user_id") or config.get("configurable", {}).get("thread_id")
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
    user_id = config.get("configurable", {}).get("user_id") or config.get("configurable", {}).get("thread_id")
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
    user_id = config.get("configurable", {}).get("user_id") or config.get("configurable", {}).get("thread_id")
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
        'SPECIFIC_DAYS_OF_MONTH',
        'AT_SPECIFIC_TIMINGS'
    ] = Field(description="Strict frequency type. MUST BE EXACTLY ONE OF the enum values. Example: if every 6 hours, use 'EVERY_X_HOURS'.", default="ONCE")
    
    frequencyValue: Optional[int] = Field(description="The numeric value 'X' for EVERY_X frequencies.", default=None)
    specificTimes: List[str] = Field(description="A list of times to take the dose (e.g., ['08:00', '20:00']). REQUIRED for all frequencies.", default_factory=list)
    specificWeekDays: Optional[List[int]] = Field(description="Array of integers 0-6 (Sun-Sat) for specific days of the week.", default=None)
    specificDaysOfMonth: Optional[List[int]] = Field(description="Array of integers 1-31 for specific days of the month.", default=None)

    duration: Literal[
        'SINGLE_DAY',
        'FOR_X_DAYS',
        'FOR_X_WEEKS',
        'FOR_X_MONTHS',
        'UNTIL_DATE',
        'CONTINUOUS'
    ] = Field(description="Strict duration type. MUST BE EXACTLY ONE OF the enum values.", default="CONTINUOUS")
    
    durationValue: Optional[int] = Field(description="The numeric value 'X' for FOR_X durations.", default=None)
    
    startDate: str = Field(
        description=(
            "REQUIRED. ISO-8601 datetime string for when the schedule begins, IN LOCAL TIME WITH OFFSET. "
            "e.g. '2026-03-09T08:00:00+05:30'. "
            "Call get_current_datetime first to get the accurate current timezone and datetime."
        )
    )
    endDate: Optional[str] = Field(
        description=(
            "ISO-8601 datetime string for when a UNTIL_DATE reminder schedule ends. "
            "Only set when duration='UNTIL_DATE'."
        ),
        default=None
    )

@tool("schedule_reminder", args_schema=ScheduleReminderInput)
def schedule_reminder(
    medicine_name: str, 
    dosage: str, 
    startDate: str,
    specificTimes: List[str],
    config: RunnableConfig,
    frequency: str = "ONCE",
    frequencyValue: Optional[int] = None,
    specificWeekDays: Optional[List[int]] = None,
    specificDaysOfMonth: Optional[List[int]] = None,
    duration: str = "CONTINUOUS",
    durationValue: Optional[int] = None,
    endDate: Optional[str] = None
) -> Dict[str, Any]:
    """Writes a new reminder to the database."""
    user_id = config.get("configurable", {}).get("user_id") or config.get("configurable", {}).get("thread_id")
    client_tz = get_client_tz(config)

    # Strip any hallucinated LLM tzinfo and strictly use client_tz for exact mathematical local times
    try:
        local_dt = datetime.fromisoformat(startDate)
        local_dt = local_dt.replace(tzinfo=None).replace(tzinfo=client_tz)
    except ValueError:
        return {"error": "Invalid startDate format. Must be ISO-8601."}
        
    utc_specific_times = []
    for time_str in specificTimes:
        try:
            hours, minutes = parse_time_str(time_str)
            temp_dt = local_dt.replace(hour=hours, minute=minutes, second=0, microsecond=0)
            # Convert the specific time to UTC representation for the backend payload array
            utc_dt = temp_dt.astimezone(timezone.utc)
            utc_specific_times.append(f"{utc_dt.hour:02d}:{utc_dt.minute:02d}")
        except Exception as e:
            logger.error(f"Error converting time to utc: {e}")
            utc_specific_times.append(time_str) # Fallback

    utc_start_date = local_dt.astimezone(timezone.utc).isoformat()

    url = f"{MEDICINE_SCHEDULER_URL}/reminders/{user_id}"
    payload = {
        "medicineName": medicine_name,
        "dosage": dosage,
        "frequency": frequency,
        "duration": duration,
        "startDate": utc_start_date,
        "specificTimes": utc_specific_times
    }
        
    # Add optional fields only if provided to prevent sending nulls confusing the db
    if frequencyValue is not None: payload["frequencyValue"] = frequencyValue
    if specificWeekDays is not None: payload["specificWeekDays"] = specificWeekDays
    if specificDaysOfMonth is not None: payload["specificDaysOfMonth"] = specificDaysOfMonth
    if durationValue is not None: payload["durationValue"] = durationValue
    
    if endDate is not None: 
        try:
            end_dt = datetime.fromisoformat(endDate)
            end_dt = end_dt.replace(tzinfo=None).replace(tzinfo=client_tz)
            payload["endDate"] = end_dt.astimezone(timezone.utc).isoformat()
        except ValueError:
            payload["endDate"] = endDate

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Error calling schedule_reminder: {e}")
        return {"error": str(e), "message": "Failed to schedule. Did you provide the exact ENUM literal values?"}

class UpdateReminderInput(BaseModel):
    reminderId: str = Field(description="The exact _id of the reminder to update.")
    medicine_name: Optional[str] = Field(description="Name of the medicine.", default=None)
    dosage: Optional[str] = Field(description="Dosage instructions (e.g., '1 tablet', '500mg').", default=None)
    frequency: Optional[Literal[
        'ONCE', 
        'DAILY', 
        'X_TIMES_DAILY', 
        'EVERY_X_HOURS', 
        'EVERY_X_MINUTES', 
        'SPECIFIC_WEEK_DAYS', 
        'SPECIFIC_DAYS_OF_MONTH',
        'AT_SPECIFIC_TIMINGS'
    ]] = Field(description="Strict frequency type enum.", default=None)
    frequencyValue: Optional[int] = Field(description="The numeric value 'X' for EVERY_X frequencies.", default=None)
    specificTimes: Optional[List[str]] = Field(description="A list of times to take the dose (e.g., ['08:00', '20:00']).", default=None)
    specificWeekDays: Optional[List[int]] = Field(description="Array of integers 0-6 (Sun-Sat) for specific days of the week.", default=None)
    specificDaysOfMonth: Optional[List[int]] = Field(description="Array of integers 1-31 for specific days of the month.", default=None)
    duration: Optional[Literal[
        'SINGLE_DAY',
        'FOR_X_DAYS',
        'FOR_X_WEEKS',
        'FOR_X_MONTHS',
        'UNTIL_DATE',
        'CONTINUOUS'
    ]] = Field(description="Strict duration type enum.", default=None)
    durationValue: Optional[int] = Field(description="The numeric value 'X' for FOR_X durations.", default=None)
    startDate: Optional[str] = Field(description="ISO-8601 string for start date.", default=None)
    endDate: Optional[str] = Field(description="ISO-8601 string for end date (UNTIL_DATE duration).", default=None)

@tool("update_reminder", args_schema=UpdateReminderInput)
def update_reminder(
    reminderId: str,
    config: RunnableConfig,
    medicine_name: Optional[str] = None,
    dosage: Optional[str] = None,
    frequency: Optional[str] = None,
    frequencyValue: Optional[int] = None,
    specificTimes: Optional[List[str]] = None,
    specificWeekDays: Optional[List[int]] = None,
    specificDaysOfMonth: Optional[List[int]] = None,
    duration: Optional[str] = None,
    durationValue: Optional[int] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None
) -> Dict[str, Any]:
    """Updates an existing reminder in the database. Call get_upcoming_reminders first to find the exact reminderId."""
    user_id = config.get("configurable", {}).get("user_id") or config.get("configurable", {}).get("thread_id")
    
    try:
        # Fetch existing reminders to find the one to update
        get_url = f"{MEDICINE_SCHEDULER_URL}/reminders/{user_id}"
        get_resp = requests.get(get_url)
        get_resp.raise_for_status()
        reminders = get_resp.json()
        
        # Check standard lists or paginated format {"reminders": [...]}
        reminder_list = reminders if isinstance(reminders, list) else reminders.get("reminders", [])
        existing = next((r for r in reminder_list if r.get("_id") == reminderId or r.get("id") == reminderId), None)
        
        if existing is None:
            return {"error": f"Could not find an active reminder with ID {reminderId}."}
            
        client_tz = get_client_tz(config)

        payload = {}
        # Merge fields
        payload["medicineName"] = medicine_name if medicine_name is not None else existing.get("medicineName")
        payload["dosage"] = dosage if dosage is not None else existing.get("dosage")
        payload["frequency"] = frequency if frequency is not None else existing.get("frequency")
        payload["duration"] = duration if duration is not None else existing.get("duration")
        
        if frequencyValue is not None: payload["frequencyValue"] = frequencyValue 
        elif "frequencyValue" in existing: payload["frequencyValue"] = existing["frequencyValue"]
            
        if specificWeekDays is not None: payload["specificWeekDays"] = specificWeekDays
        elif "specificWeekDays" in existing: payload["specificWeekDays"] = existing["specificWeekDays"]
            
        if specificDaysOfMonth is not None: payload["specificDaysOfMonth"] = specificDaysOfMonth
        elif "specificDaysOfMonth" in existing: payload["specificDaysOfMonth"] = existing["specificDaysOfMonth"]
            
        if durationValue is not None: payload["durationValue"] = durationValue
        elif "durationValue" in existing: payload["durationValue"] = existing["durationValue"]

        active_start_date = startDate if startDate is not None else existing.get("startDate")
        active_end_date = endDate if endDate is not None else existing.get("endDate")
        active_specific_times = specificTimes if specificTimes is not None else existing.get("specificTimes", [])

        # Time calculation logic
        try:
            # Parse the start date (either new from LLM or existing from DB)
            base_dt = datetime.fromisoformat(active_start_date.replace("Z", "+00:00"))
            
            # We must represent the base date in the user's explicit local timezone for mathematical hour/minute replacement
            local_start_dt = base_dt.astimezone(client_tz)
            
            # If the LLM explicitly sent a new startDate, it might have hallucinated a tz offset, so strip it
            if startDate is not None:
                local_start_dt = datetime.fromisoformat(startDate)
                local_start_dt = local_start_dt.replace(tzinfo=None).replace(tzinfo=client_tz)
                
        except ValueError:
             return {"error": "Invalid startDate format. Must be ISO-8601."}
        
        utc_specific_times = []
        for time_str in active_specific_times:
            if specificTimes is None:
                # Times from DB are already beautifully formatted UTC strings. Do not modify.
                utc_specific_times.append(time_str)
            else:
                try:
                    hours, minutes = parse_time_str(time_str)
                    temp_dt = local_start_dt.replace(hour=hours, minute=minutes, second=0, microsecond=0)
                    utc_dt = temp_dt.astimezone(timezone.utc)
                    utc_specific_times.append(f"{utc_dt.hour:02d}:{utc_dt.minute:02d}")
                except Exception as e:
                    logger.error(f"Error converting time to utc in update: {e}")
                    utc_specific_times.append(time_str)

        utc_start_date = local_start_dt.astimezone(timezone.utc).isoformat()
        payload["startDate"] = utc_start_date
        payload["specificTimes"] = utc_specific_times
        
        if active_end_date is not None:
            if endDate is not None:
                 try:
                     end_dt = datetime.fromisoformat(active_end_date)
                     end_dt = end_dt.replace(tzinfo=None).replace(tzinfo=client_tz)
                     payload["endDate"] = end_dt.astimezone(timezone.utc).isoformat()
                 except ValueError:
                     payload["endDate"] = active_end_date
            else:
                 payload["endDate"] = active_end_date
                 
        put_url = f"{MEDICINE_SCHEDULER_URL}/reminders/{reminderId}/{user_id}"
        put_resp = requests.put(put_url, json=payload)
        put_resp.raise_for_status()
        return put_resp.json()
        
    except requests.RequestException as e:
        logger.error(f"Error calling update_reminder: {e}")
        return {"error": str(e), "message": "Failed to update reminder."}

class GenerateMedicalSummaryInput(BaseModel):
    pass

@tool("generate_medical_summary", args_schema=GenerateMedicalSummaryInput)
def generate_medical_summary(config: RunnableConfig) -> Dict[str, Any]:
    """Generates a medical and clinical summary of the user by getting medications and medical info."""
    user_id = config.get("configurable", {}).get("user_id") or config.get("configurable", {}).get("thread_id")
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
def get_current_datetime(config: RunnableConfig) -> str:
    """Gets the current date and time formatted in ISO-8601 inside the user's specific local timezone."""
    client_tz = get_client_tz(config)
    now = datetime.now(client_tz)
    return now.isoformat()

tools = [
    get_upcoming_reminders,
    get_pending_or_missed_reminders,
    analyze_medicine,
    check_medicine_taken,
    check_schedule_complications,
    schedule_reminder,
    update_reminder,
    generate_medical_summary,
    get_current_datetime,
]

core_tools = tools.copy()
