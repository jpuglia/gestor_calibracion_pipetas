from fastapi.testclient import TestClient
from sqlmodel import Session

from models import Pipette, Specification


def test_sequential_repetition_count(client: TestClient, session: Session):
    # 1. Setup: Create Pipette and Specification
    pipette = Pipette(
        codigo="PP-SEQ",
        description="Sequential Test",
        brand="Brand",
        model="Model",
        serial_number="SN-SEQ",
        status="En Uso",
        max_volume=100.0,
    )
    session.add(pipette)
    session.commit()
    session.refresh(pipette)

    spec = Specification(pipette_id=pipette.id, volume=50.0, max_error=1.0)
    session.add(spec)
    session.commit()

    # 2. Create Event
    event_data = {
        "pipette_id": pipette.id,
        "type_event": "calibración",
        "date_calibration": "2026-03-05",
        "service_provider": "Test Labs",
        "expiration_date": "2027-03-05",
    }
    response = client.post("/events", json=event_data)
    assert response.status_code == 200
    event_id = response.json()["id"]

    # 3. Add first result (Rep 1, Pass)
    res1_data = {
        "event_log_id": event_id,
        "tested_volume": 50.0,
        "measured_error": 0.5,
        "report_number": "REP-001",
    }
    response = client.post("/results", json=res1_data)
    assert response.status_code == 200
    res1 = response.json()
    assert res1["repetition_count"] == 1
    assert res1["is_oos"] is False

    # 4. Add second result (Rep 2, Fail/OOS)
    res2_data = {
        "event_log_id": event_id,
        "tested_volume": 50.0,
        "measured_error": 1.5,
        "report_number": "REP-001",
    }
    response = client.post("/results", json=res2_data)
    assert response.status_code == 200
    res2 = response.json()
    assert res2["repetition_count"] == 2
    assert res2["is_oos"] is True

    # 5. Add third result (Rep 3, different volume, Pass)
    # Note: rep_count is per event_log_id as per requirement
    res3_data = {
        "event_log_id": event_id,
        "tested_volume": 10.0,  # No spec for this volume
        "measured_error": 0.1,
        "report_number": "REP-001",
    }
    response = client.post("/results", json=res3_data)
    assert response.status_code == 200
    res3 = response.json()
    assert res3["repetition_count"] == 3
    assert res3["is_oos"] is False  # Default is False if no spec


def test_result_missing_event(client: TestClient):
    res_data = {
        "event_log_id": 9999,
        "tested_volume": 50.0,
        "measured_error": 0.5,
        "report_number": "REP-999",
    }
    response = client.post("/results", json=res_data)
    assert response.status_code == 404
    assert response.json()["detail"] == "Event Log not found"
