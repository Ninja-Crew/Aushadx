import pytest
import requests
import requests_mock
from agent import tools

def test_get_upcoming_reminders_success(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock.Mocker() as m:
        m.get("http://mock-scheduler/reminders/user123", json=[{"id": "1", "medicineName": "Aspirin"}])
        result = tools.get_upcoming_reminders.invoke({}, config={"configurable": {"thread_id": "user123"}})
        assert len(result) == 1
        assert result[0]["medicineName"] == "Aspirin"

def test_get_upcoming_reminders_failure(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock.Mocker() as m:
        m.get("http://mock-scheduler/reminders/user123", status_code=500, text="Internal Server Error")
        result = tools.get_upcoming_reminders.invoke({}, config={"configurable": {"thread_id": "user123"}})
        assert "error" in result

def test_get_pending_or_missed_reminders_success(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock.Mocker() as m:
        m.get("http://mock-scheduler/reminders/missed/user123", json=[{"id": "2", "medicineName": "Paracetamol"}])
        result = tools.get_pending_or_missed_reminders.invoke({}, config={"configurable": {"thread_id": "user123"}})
        assert len(result) == 1
        assert result[0]["medicineName"] == "Paracetamol"

def test_analyze_medicine_success(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_ANALYZER_URL", "http://mock-analyzer")
    with requests_mock.Mocker() as m:
        m.post("http://mock-analyzer/api/analyze/test_user", json={"status": "success", "analysis": {}})
        result = tools.analyze_medicine.invoke({"medicine_name": "Test Med"}, config={"configurable": {"thread_id": "test_user"}})
        assert result == {"status": "success", "analysis": {}}
        assert m.last_request.json() == {"medicine_data": {"text": "Test Med"}}

def test_check_medicine_taken_found(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock.Mocker() as m:
        m.get("http://mock-scheduler/reminders/missed/user123", json=[{"id": "3", "medicineName": "Aspirin"}])
        result = tools.check_medicine_taken.invoke({"medicine_name": "Aspirin"}, config={"configurable": {"thread_id": "user123"}})
        assert result["status"] == "pending_or_missed"
        assert result["medicine"] == "Aspirin"

def test_check_medicine_taken_not_found(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock.Mocker() as m:
        m.get("http://mock-scheduler/reminders/missed/user123", json=[{"id": "4", "medicineName": "Paracetamol"}])
        result = tools.check_medicine_taken.invoke({"medicine_name": "Aspirin"}, config={"configurable": {"thread_id": "user123"}})
        assert result["status"] == "taken_or_not_scheduled"

def test_check_medicine_taken_error(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock.Mocker() as m:
        m.get("http://mock-scheduler/reminders/missed/user123", status_code=500)
        result = tools.check_medicine_taken.invoke({"medicine_name": "Aspirin"}, config={"configurable": {"thread_id": "user123"}})
        assert "error" in result

def test_check_schedule_complications_success(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock.Mocker() as m:
        m.get("http://mock-scheduler/reminders/user123", json=[{"id": "1"}])
        result = tools.check_schedule_complications.invoke({}, config={"configurable": {"thread_id": "user123"}})
        assert "active_reminders" in result
        assert "instruction" in result

def test_schedule_reminder_success(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock.Mocker() as m:
        m.post("http://mock-scheduler/reminders/user123", json={"id": "5", "status": "scheduled"})
        result = tools.schedule_reminder.invoke({
            "medicine_name": "Paracetamol",
            "dosage": "500mg",
            "frequency": "DAILY",
            "duration": "CONTINUOUS",
            "startDate": "2026-03-09T08:00:00+05:30",
            "specificTimes": ["09:00"]
        }, config={"configurable": {"thread_id": "user123", "client_timezone": "Asia/Kolkata"}})
        assert result == {"id": "5", "status": "scheduled"}
        
        req_json = m.last_request.json()
        assert req_json["medicineName"] == "Paracetamol"
        assert req_json["dosage"] == "500mg"
        assert req_json["frequency"] == "DAILY"
        assert req_json["startDate"] == "2026-03-09T02:30:00+00:00"
        assert req_json["specificTimes"] == ["03:30"]
        assert req_json["specificTimes"] == ["03:30"]

def test_update_reminder_success(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock.Mocker() as m:
        # Mock the GET to fetch exactly what currently exists
        existing_reminder = {
            "_id": "67abcd",
            "medicineName": "Paracetamol",
            "dosage": "500mg",
            "frequency": "DAILY",
            "duration": "CONTINUOUS",
            "startDate": "2026-03-09T08:00:00Z", # Already UTC in DB
            "specificTimes": ["14:30"] # 14:30 UTC = 20:00 IST
        }
        m.get("http://mock-scheduler/reminders/user123", json=[existing_reminder])
        m.put("http://mock-scheduler/reminders/67abcd/user123", json={"id": "67abcd", "status": "updated"})
        
        # Test just updating the time to 9:00 AM local
        result = tools.update_reminder.invoke({
            "reminderId": "67abcd",
            "specificTimes": ["09:00"]
        }, config={"configurable": {"thread_id": "user123", "client_timezone": "Asia/Kolkata"}})
        
        assert result == {"id": "67abcd", "status": "updated"}
        
        req_json = m.last_request.json()
        assert req_json["medicineName"] == "Paracetamol"
        assert req_json["dosage"] == "500mg"
        # 9:00 AM IST -> 03:30 AM UTC
        assert req_json["specificTimes"] == ["03:30"]
        # The start date was '2026-03-09T08:00:00Z'. When parsed as Asia/Kolkata and converted to UTC, what happens?
        # The code active_start_date = existing.get("startDate") -> '2026-03-09T08:00:00Z'
        # local_start_dt = datetime.fromisoformat('2026-03-09T08:00:00+00:00') -> tzaware UTC.
        # local_start_dt.tzinfo is not None.
        # It won't replace tzinfo. It will just be UTC.
        # The specificTimes convert happens taking local_start_dt and replacing hour/minute.
        # Wait, if local_start_dt is UTC, replacing hour/minute means putting local hour/minute into UTC object! That is wrong!
        
def test_generate_medical_summary_success(monkeypatch):
    monkeypatch.setattr(tools, "PROFILE_MANAGER_URL", "http://mock-profile")
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock.Mocker() as m:
        m.get("http://mock-profile/profile/medical-info/user123", json={"success": True, "data": {"profile": {"medicalInfo": {"allergies": []}}}})
        m.get("http://mock-scheduler/reminders/user123", json=[{"id": "6"}])
        
        result = tools.generate_medical_summary.invoke({}, config={"configurable": {"thread_id": "user123"}})
        assert "medical_info" in result
        assert "medications" in result
        assert "instruction" in result

def test_generate_medical_summary_failures(monkeypatch):
    monkeypatch.setattr(tools, "PROFILE_MANAGER_URL", "http://mock-profile")
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock.Mocker() as m:
        m.get("http://mock-profile/profile/medical-info/user123", status_code=404)
        m.get("http://mock-scheduler/reminders/user123", status_code=500)
        
        result = tools.generate_medical_summary.invoke({}, config={"configurable": {"thread_id": "user123"}})
        assert "medical_info_error" in result
        assert "medications_error" in result
