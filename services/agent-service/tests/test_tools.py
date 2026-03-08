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
            "time": "09:00 AM"
        }, config={"configurable": {"thread_id": "user123"}})
        assert result == {"id": "5", "status": "scheduled"}
        assert m.last_request.json() == {
            "medicineName": "Paracetamol",
            "dosage": "500mg",
            "frequency": "DAILY",
            "duration": "CONTINUOUS",
            "time": "09:00 AM"
        }

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
