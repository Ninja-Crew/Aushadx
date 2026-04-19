from typing import Any, Dict


def config(user_id: str = "user123", timezone: str = "Asia/Kolkata", tz_offset: str = "-330") -> Dict[str, Any]:
    return {
        "configurable": {
            "thread_id": user_id,
            "user_id": user_id,
            "client_timezone": timezone,
            "client_tz_offset": tz_offset,
        }
    }


def profile_payload() -> Dict[str, Any]:
    return {
        "success": True,
        "data": {
            "profile": {
                "medicalInfo": {
                    "allergies": ["penicillin"],
                    "bloodType": "A+",
                }
            }
        },
    }
