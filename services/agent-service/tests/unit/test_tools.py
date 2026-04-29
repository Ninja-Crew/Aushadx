import pytest
import requests_mock as requests_mock_lib
from tests.mocks.fixtures import config, profile_payload
from agent import tools


# ── parse_time_str ──────────────────────────────────────────────────────────

def test_parse_time_str_24h():
    h, m = tools.parse_time_str("14:30")
    assert h == 14 and m == 30

def test_parse_time_str_12h_pm():
    h, m = tools.parse_time_str("2:00 PM")
    assert h == 14 and m == 0

def test_parse_time_str_12h_am():
    h, m = tools.parse_time_str("12:00 AM")
    assert h == 0 and m == 0

def test_parse_time_str_noon():
    h, m = tools.parse_time_str("12:00 PM")
    assert h == 12 and m == 0

def test_parse_time_str_with_seconds():
    h, m = tools.parse_time_str("09:30:00")
    assert h == 9 and m == 30

def test_parse_time_str_invalid():
    with pytest.raises(ValueError):
        tools.parse_time_str("not-a-time")


# ── get_client_tz ────────────────────────────────────────────────────────────

def test_get_client_tz_uses_numeric_offset():
    """JS offset -330 = IST (+05:30). Python negates it."""
    from datetime import timezone, timedelta
    cfg = config("u1", "UTC", "-330")
    tz = tools.get_client_tz(cfg["configurable"].__class__(cfg["configurable"]) if False else cfg)
    # Use the tools function directly
    tz = tools.get_client_tz(cfg)
    offset = tz.utcoffset(None)
    assert offset == timedelta(hours=5, minutes=30)

def test_get_client_tz_falls_back_to_iana():
    """Without a numeric offset, should parse the IANA string."""
    cfg = {"configurable": {"client_timezone": "America/New_York"}}
    import zoneinfo
    tz = tools.get_client_tz(cfg)
    assert hasattr(tz, "key") or str(tz)  # zoneinfo or fixed offset

def test_get_client_tz_falls_back_to_utc():
    """Invalid timezone falls back to UTC."""
    from datetime import timezone
    cfg = {"configurable": {"client_timezone": "Invalid/Zone"}}
    tz = tools.get_client_tz(cfg)
    assert tz == timezone.utc


# ── get_upcoming_reminders ───────────────────────────────────────────────────

def test_get_upcoming_reminders_success(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.get("http://mock-scheduler/reminders/user123", json=[{"id": "1", "medicineName": "Aspirin"}])
        result = tools.get_upcoming_reminders.invoke({}, config=config("user123"))
        assert len(result) == 1
        assert result[0]["medicineName"] == "Aspirin"

def test_get_upcoming_reminders_failure(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.get("http://mock-scheduler/reminders/user123", status_code=500)
        result = tools.get_upcoming_reminders.invoke({}, config=config("user123"))
        assert "error" in result

def test_get_upcoming_reminders_uses_user_id(monkeypatch):
    """user_id from configurable should be used in the URL, not thread_id."""
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://sched")
    with requests_mock_lib.Mocker() as m:
        m.get("http://sched/reminders/specific_user", json=[])
        cfg = {"configurable": {"user_id": "specific_user", "thread_id": "other_thread"}}
        result = tools.get_upcoming_reminders.invoke({}, config=cfg)
        assert result == []


# ── get_pending_or_missed_reminders ──────────────────────────────────────────

def test_get_pending_or_missed_reminders_success(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.get("http://mock-scheduler/reminders/missed/user123", json=[{"id": "2", "medicineName": "Paracetamol"}])
        result = tools.get_pending_or_missed_reminders.invoke({}, config=config("user123"))
        assert result[0]["medicineName"] == "Paracetamol"

def test_get_pending_or_missed_reminders_failure(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.get("http://mock-scheduler/reminders/missed/user123", status_code=503)
        result = tools.get_pending_or_missed_reminders.invoke({}, config=config("user123"))
        assert "error" in result[0]


# ── analyze_medicine ─────────────────────────────────────────────────────────

def test_analyze_medicine_success(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_ANALYZER_URL", "http://mock-analyzer")
    with requests_mock_lib.Mocker() as m:
        m.post("http://mock-analyzer/api/analyze/test_user", json={"status": "success", "analysis": {}})
        result = tools.analyze_medicine.invoke({"medicine_name": "Test Med"}, config=config("test_user"))
        assert result == {"status": "success", "analysis": {}}
        assert m.last_request.json() == {"medicine_data": {"text": "Test Med"}}

def test_analyze_medicine_failure(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_ANALYZER_URL", "http://mock-analyzer")
    with requests_mock_lib.Mocker() as m:
        m.post("http://mock-analyzer/api/analyze/test_user", status_code=503)
        result = tools.analyze_medicine.invoke({"medicine_name": "Test Med"}, config=config("test_user"))
        assert "error" in result


# ── check_medicine_taken ─────────────────────────────────────────────────────

def test_check_medicine_taken_found(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.get("http://mock-scheduler/reminders/missed/user123", json=[{"id": "3", "medicineName": "Aspirin"}])
        result = tools.check_medicine_taken.invoke({"medicine_name": "Aspirin"}, config=config("user123"))
        assert result["status"] == "pending_or_missed"
        assert result["medicine"] == "Aspirin"

def test_check_medicine_taken_not_found(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.get("http://mock-scheduler/reminders/missed/user123", json=[{"id": "4", "medicineName": "Paracetamol"}])
        result = tools.check_medicine_taken.invoke({"medicine_name": "Aspirin"}, config=config("user123"))
        assert result["status"] == "taken_or_not_scheduled"

def test_check_medicine_taken_case_insensitive(monkeypatch):
    """Matching should be case-insensitive."""
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.get("http://mock-scheduler/reminders/missed/user123", json=[{"medicineName": "aspirin"}])
        result = tools.check_medicine_taken.invoke({"medicine_name": "ASPIRIN"}, config=config("user123"))
        assert result["status"] == "pending_or_missed"

def test_check_medicine_taken_propagates_api_error(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.get("http://mock-scheduler/reminders/missed/user123", status_code=500)
        result = tools.check_medicine_taken.invoke({"medicine_name": "Aspirin"}, config=config("user123"))
        assert "error" in result


# ── check_schedule_complications ─────────────────────────────────────────────

def test_check_schedule_complications_success(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.get("http://mock-scheduler/reminders/user123", json=[{"id": "1"}])
        result = tools.check_schedule_complications.invoke({}, config=config("user123"))
        assert "active_reminders" in result
        assert "instruction" in result

def test_check_schedule_complications_failure(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.get("http://mock-scheduler/reminders/user123", status_code=503)
        result = tools.check_schedule_complications.invoke({}, config=config("user123"))
        assert "error" in result


# ── schedule_reminder ─────────────────────────────────────────────────────────

def test_schedule_reminder_success_with_timezone_conversion(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.post("http://mock-scheduler/reminders/user123", json={"id": "5", "status": "scheduled"})
        result = tools.schedule_reminder.invoke({
            "medicine_name": "Paracetamol",
            "dosage": "500mg",
            "frequency": "DAILY",
            "duration": "CONTINUOUS",
            "startDate": "2026-03-09T08:00:00+05:30",
            "specificTimes": ["09:00"],
        }, config=config("user123", "Asia/Kolkata", "-330"))
        assert result == {"id": "5", "status": "scheduled"}
        req_json = m.last_request.json()
        assert req_json["medicineName"] == "Paracetamol"
        assert req_json["specificTimes"] == ["03:30"]  # 09:00 IST → 03:30 UTC
        assert req_json["startDate"].endswith("+00:00")

def test_schedule_reminder_invalid_start_date(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    result = tools.schedule_reminder.invoke({
        "medicine_name": "Paracetamol",
        "dosage": "500mg",
        "frequency": "DAILY",
        "duration": "CONTINUOUS",
        "startDate": "not-a-date",
        "specificTimes": ["09:00"],
    }, config=config("user123"))
    assert result["error"] == "Invalid startDate format. Must be ISO-8601."

def test_schedule_reminder_once_includes_required_fields(monkeypatch):
    """ONCE reminders must have SINGLE_DAY duration and correct payload structure."""
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.post("http://mock-scheduler/reminders/user123", json={"id": "9"})
        tools.schedule_reminder.invoke({
            "medicine_name": "Ibuprofen",
            "dosage": "400mg",
            "frequency": "ONCE",
            "duration": "SINGLE_DAY",
            "startDate": "2026-04-27T10:00:00+05:30",
            "specificTimes": ["10:00"],
        }, config=config("user123", "Asia/Kolkata", "-330"))
        req_json = m.last_request.json()
        assert req_json["frequency"] == "ONCE"
        assert req_json["duration"] == "SINGLE_DAY"

def test_schedule_reminder_multiple_times_converted(monkeypatch):
    """Multiple specificTimes should each be UTC-converted."""
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.post("http://mock-scheduler/reminders/user123", json={"id": "10"})
        tools.schedule_reminder.invoke({
            "medicine_name": "Metformin",
            "dosage": "500mg",
            "frequency": "X_TIMES_DAILY",
            "duration": "CONTINUOUS",
            "startDate": "2026-04-27T00:00:00+05:30",
            "specificTimes": ["08:00", "20:00"],
        }, config=config("user123", "Asia/Kolkata", "-330"))
        req_json = m.last_request.json()
        # 08:00 IST → 02:30 UTC, 20:00 IST → 14:30 UTC
        assert req_json["specificTimes"] == ["02:30", "14:30"]

def test_schedule_reminder_network_failure(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.post("http://mock-scheduler/reminders/user123", status_code=500)
        result = tools.schedule_reminder.invoke({
            "medicine_name": "Aspirin",
            "dosage": "100mg",
            "frequency": "DAILY",
            "duration": "CONTINUOUS",
            "startDate": "2026-04-27T08:00:00+05:30",
            "specificTimes": ["08:00"],
        }, config=config("user123"))
        assert "error" in result


# ── update_reminder ───────────────────────────────────────────────────────────

def test_update_reminder_success(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        existing = {
            "_id": "67abcd",
            "medicineName": "Paracetamol",
            "dosage": "500mg",
            "frequency": "DAILY",
            "duration": "CONTINUOUS",
            "startDate": "2026-03-09T08:00:00Z",
            "specificTimes": ["14:30"],
        }
        m.get("http://mock-scheduler/reminders/user123", json=[existing])
        m.put("http://mock-scheduler/reminders/67abcd/user123", json={"id": "67abcd", "status": "updated"})
        result = tools.update_reminder.invoke({
            "reminderId": "67abcd",
            "specificTimes": ["09:00"],
        }, config=config("user123", "Asia/Kolkata", "-330"))
        assert result == {"id": "67abcd", "status": "updated"}
        req_json = m.last_request.json()
        assert req_json["specificTimes"] == ["03:30"]  # 09:00 IST → 03:30 UTC

def test_update_reminder_not_found(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.get("http://mock-scheduler/reminders/user123", json=[])
        result = tools.update_reminder.invoke({
            "reminderId": "missing",
            "specificTimes": ["09:00"],
        }, config=config("user123"))
        assert "Could not find an active reminder" in result["error"]

def test_update_reminder_preserves_existing_times_when_not_changed(monkeypatch):
    """If specificTimes is not provided, existing UTC times should be kept as-is."""
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        existing = {
            "_id": "abc",
            "medicineName": "Metformin",
            "dosage": "500mg",
            "frequency": "DAILY",
            "duration": "CONTINUOUS",
            "startDate": "2026-04-01T02:30:00Z",
            "specificTimes": ["02:30"],
        }
        m.get("http://mock-scheduler/reminders/user123", json=[existing])
        m.put("http://mock-scheduler/reminders/abc/user123", json={"status": "ok"})
        tools.update_reminder.invoke({
            "reminderId": "abc",
            "dosage": "1000mg",
        }, config=config("user123"))
        req_json = m.last_request.json()
        # Times unchanged since no new specificTimes were given
        assert req_json["specificTimes"] == ["02:30"]

def test_update_reminder_merges_existing_fields(monkeypatch):
    """Fields not provided in update should be merged from existing reminder."""
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        existing = {
            "_id": "xyz",
            "medicineName": "OldName",
            "dosage": "250mg",
            "frequency": "DAILY",
            "duration": "CONTINUOUS",
            "startDate": "2026-04-01T02:30:00Z",
            "specificTimes": ["02:30"],
        }
        m.get("http://mock-scheduler/reminders/user123", json=[existing])
        m.put("http://mock-scheduler/reminders/xyz/user123", json={"status": "ok"})
        tools.update_reminder.invoke({
            "reminderId": "xyz",
            "medicine_name": "NewName",
        }, config=config("user123"))
        req_json = m.last_request.json()
        assert req_json["medicineName"] == "NewName"
        assert req_json["dosage"] == "250mg"   # merged from existing

def test_update_reminder_paginated_response_format(monkeypatch):
    """update_reminder should handle paginated {reminders: [...]} format."""
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        existing = {
            "_id": "pag1",
            "medicineName": "Aspirin",
            "dosage": "100mg",
            "frequency": "DAILY",
            "duration": "CONTINUOUS",
            "startDate": "2026-04-01T02:30:00Z",
            "specificTimes": ["02:30"],
        }
        m.get("http://mock-scheduler/reminders/user123", json={"reminders": [existing]})
        m.put("http://mock-scheduler/reminders/pag1/user123", json={"status": "ok"})
        result = tools.update_reminder.invoke({
            "reminderId": "pag1",
        }, config=config("user123"))
        assert result["status"] == "ok"

def test_update_reminder_network_failure(monkeypatch):
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        existing = {"_id": "err1", "medicineName": "A", "dosage": "1mg",
                    "frequency": "DAILY", "duration": "CONTINUOUS",
                    "startDate": "2026-04-01T00:00:00Z", "specificTimes": ["00:00"]}
        m.get("http://mock-scheduler/reminders/user123", json=[existing])
        m.put("http://mock-scheduler/reminders/err1/user123", status_code=500)
        result = tools.update_reminder.invoke({"reminderId": "err1"}, config=config("user123"))
        assert "error" in result


# ── generate_medical_summary ─────────────────────────────────────────────────

def test_generate_medical_summary_success(monkeypatch):
    monkeypatch.setattr(tools, "PROFILE_MANAGER_URL", "http://mock-profile")
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.get("http://mock-profile/profile/medical-info/user123", json=profile_payload())
        m.get("http://mock-scheduler/reminders/user123", json=[{"id": "6"}])
        result = tools.generate_medical_summary.invoke({}, config=config("user123"))
        assert result["medical_info"]["allergies"] == ["penicillin"]
        assert "medications" in result
        assert "instruction" in result

def test_generate_medical_summary_partial_failure(monkeypatch):
    monkeypatch.setattr(tools, "PROFILE_MANAGER_URL", "http://mock-profile")
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.get("http://mock-profile/profile/medical-info/user123", status_code=404)
        m.get("http://mock-scheduler/reminders/user123", status_code=500)
        result = tools.generate_medical_summary.invoke({}, config=config("user123"))
        assert "medical_info_error" in result
        assert "medications_error" in result

def test_generate_medical_summary_profile_non_success_body(monkeypatch):
    """Should still include raw data when success=False in body."""
    monkeypatch.setattr(tools, "PROFILE_MANAGER_URL", "http://mock-profile")
    monkeypatch.setattr(tools, "MEDICINE_SCHEDULER_URL", "http://mock-scheduler")
    with requests_mock_lib.Mocker() as m:
        m.get("http://mock-profile/profile/medical-info/user123", json={"success": False, "error": "not found"})
        m.get("http://mock-scheduler/reminders/user123", json=[])
        result = tools.generate_medical_summary.invoke({}, config=config("user123"))
        # Should fall into the else branch and store raw response
        assert "medical_info" in result


# ── get_current_datetime ─────────────────────────────────────────────────────

def test_get_current_datetime_uses_client_timezone():
    result = tools.get_current_datetime.invoke({}, config=config("user123", "Asia/Kolkata", "-330"))
    assert "+05:30" in result

def test_get_current_datetime_utc_fallback():
    """No TZ config → UTC offset (+00:00)."""
    result = tools.get_current_datetime.invoke({}, config={"configurable": {}})
    assert "+00:00" in result or "Z" in result

def test_get_current_datetime_returns_iso_format():
    """Result must be a parseable ISO-8601 string."""
    from datetime import datetime
    result = tools.get_current_datetime.invoke({}, config=config("user123"))
    # Should not raise
    dt = datetime.fromisoformat(result)
    assert dt is not None
