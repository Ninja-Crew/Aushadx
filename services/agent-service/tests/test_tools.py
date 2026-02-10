import pytest
import requests
import requests_mock
from agent import tools

def test_analyze_medicine_success(monkeypatch):
    print("Starting test...")
    # Patch the global variable in the module
    monkeypatch.setattr(tools, "MEDICINE_ANALYZER_URL", "http://mock-analyzer")
    
    with requests_mock.Mocker() as m:
        m.post("http://mock-analyzer/analyze", json={"status": "success", "data": {"name": "Test Med"}})
        
        # Use the tool from the imported module
        result = tools.analyze_medicine.invoke({"text": "sample text", "user_id": "test_user"})
        assert result == {"status": "success", "data": {"name": "Test Med"}}
        assert m.last_request.json() == {"medicine_data": {"text": "sample text"}, "userId": "test_user"}

def test_get_medicine_details_success(monkeypatch):
    # Patch the global variable in the module
    monkeypatch.setattr(tools, "MEDICINE_ANALYZER_URL", "http://mock-analyzer")
    
    with requests_mock.Mocker() as m:
        m.post("http://mock-analyzer/analyze", json={"status": "success", "data": "info"})
        
        result = tools.get_medicine_details.invoke({"medicine_name": "Aspirin", "user_id": "user123"})
        
        assert result == {"status": "success", "data": "info"}
        assert m.last_request.json() == {"medicine_data": {"text": "Information about Aspirin"}, "userId": "user123"}

def test_schedule_medicine_success(monkeypatch):
    # Patch the global variable in the module
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    
    with requests_mock.Mocker() as m:
        m.post("http://mock-scheduler/reminders", json={"id": "123", "status": "scheduled"})
        
        result = tools.schedule_medicine.invoke({
            "user_id": "user1",
            "medicine_name": "Paracetamol",
            "dosage": "500mg",
            "frequency": "daily",
            "time": "09:00 AM"
        })
        
        assert result == {"id": "123", "status": "scheduled"}
        assert m.last_request.json() == {
            "userId": "user1",
            "medicineName": "Paracetamol",
            "dosage": "500mg",
            "schedule": {
                "frequency": "daily",
                "time": "09:00 AM"
            }
        }
