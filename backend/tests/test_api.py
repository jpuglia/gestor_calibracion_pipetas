from fastapi.testclient import TestClient
from sqlmodel import Session

from models import EventLog, Pipette, Specification


def test_create_pipette(client: TestClient):
    # The app startup usually handles initial import, but for tests we start with empty DB
    # We can manually add one or test the list
    response = client.get("/pipettes")
    assert response.status_code == 200
    assert response.json() == []


def test_pipette_workflow(client: TestClient, session: Session):
    # 1. Create a pipette manually in session
    pipette = Pipette(
        codigo="PP-TEST",
        description="Test Pipette",
        brand="Test Brand",
        model="Test Model",
        serial_number="SN123",
        status="En Uso",
        max_volume=1000.0,
    )
    session.add(pipette)
    session.commit()
    session.refresh(pipette)

    # 2. Add a specification
    spec = Specification(pipette_id=pipette.id, volume=1000.0, max_error=10.0)
    session.add(spec)
    session.commit()

    # 3. Check if pipette is listable
    response = client.get("/pipettes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["codigo"] == "PP-TEST"

    # 4. Create an event via API
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

    # 5. Add a result (Pass)
    result_data = {
        "event_log_id": event_id,
        "tested_volume": 1000.0,
        "measured_error": 5.0,
        "repetition_count": 10,
        "report_number": "REP-001",
    }
    response = client.post("/results", json=result_data)
    assert response.status_code == 200

    # 6. Check Dashboard stats
    response = client.get("/dashboard/stats")
    assert response.status_code == 200
    stats = response.json()
    assert stats["total_pipettes"] == 1
    assert stats["total_events"] == 1


def test_expiration_alerts(client: TestClient, session: Session):
    # Pipette expiring soon
    pipette = Pipette(
        codigo="PP-EXPIRE",
        description="Expiring Pipette",
        brand="Brand",
        model="Model",
        serial_number="SN",
        status="En Uso",
        max_volume=100.0,
    )
    session.add(pipette)
    session.commit()
    session.refresh(pipette)

    from datetime import date, timedelta

    soon = date.today() + timedelta(days=10)

    event = EventLog(
        pipette_id=pipette.id,
        type_event="calibración",
        date_calibration=date.today(),
        service_provider="Provider",
        expiration_date=soon,
    )
    session.add(event)
    session.commit()

    response = client.get("/alerts/expirations?days=30")
    assert response.status_code == 200
    alerts = response.json()
    assert len(alerts) == 1
    assert alerts[0]["pipette_codigo"] == "PP-EXPIRE"


def test_calibration_error_tracking(client: TestClient, session: Session):
    # 1. Create a pipette manually in session
    pipette = Pipette(
        codigo="PP-ERROR-COMPREHENSIVE",
        description="Test Pipette Error",
        brand="Test Brand",
        model="Test Model",
        serial_number="SN12345-C",
        status="En Uso",
        max_volume=100.0,
    )
    session.add(pipette)
    session.commit()
    session.refresh(pipette)

    # 2. Add an event for 2026-03-01
    event_1_data = {
        "pipette_id": pipette.id,
        "type_event": "calibración",
        "date_calibration": "2026-03-01",
        "service_provider": "Test Labs 1",
        "expiration_date": "2027-03-01",
    }
    resp1 = client.post("/events", json=event_1_data)
    event_1_id = resp1.json()["id"]

    # 3. Add results for event 1 (100uL)
    client.post(
        "/results",
        json={
            "event_log_id": event_1_id,
            "tested_volume": 100.0,
            "measured_error": 0.5,
            "report_number": "REP-001",
        },
    )

    # 4. Add another event for 2026-03-05 (newer)
    event_2_data = {
        "pipette_id": pipette.id,
        "type_event": "calibración",
        "date_calibration": "2026-03-05",
        "service_provider": "Test Labs 2",
        "expiration_date": "2027-03-05",
    }
    resp2 = client.post("/events", json=event_2_data)
    event_2_id = resp2.json()["id"]

    # 5. Add multiple repetitions for event 2 (100uL)
    # Repetition 1
    client.post(
        "/results",
        json={
            "event_log_id": event_2_id,
            "tested_volume": 100.0,
            "measured_error": 0.4,
            "report_number": "REP-002",
        },
    )
    # Repetition 2 (should be the one returned for 2026-03-05)
    client.post(
        "/results",
        json={
            "event_log_id": event_2_id,
            "tested_volume": 100.0,
            "measured_error": 0.35,
            "report_number": "REP-002",
        },
    )

    # 6. Get calibration errors
    response = client.get(f"/pipettes/{pipette.id}/calibration-errors")
    assert response.status_code == 200
    errors = response.json()

    # Should return 2 distinct points (one for each date)
    assert len(errors) == 2

    # First point (2026-03-01)
    assert errors[0]["date_calibration"] == "2026-03-01"
    assert errors[0]["error_percent"] == 0.5

    # Second point (2026-03-05)
    assert errors[1]["date_calibration"] == "2026-03-05"
    assert errors[1]["error_percent"] == 0.35  # Last repetition from that date


def test_get_event_results(client: TestClient, session: Session):
    # 1. Create a pipette
    pipette = Pipette(
        codigo="PP-RES",
        description="Pipette for results test",
        brand="Brand",
        model="Model",
        serial_number="SN-RES",
        status="En Uso",
        max_volume=100.0,
    )
    session.add(pipette)
    session.commit()
    session.refresh(pipette)

    # 2. Add an event
    event_data = {
        "pipette_id": pipette.id,
        "type_event": "calibración",
        "date_calibration": "2026-03-10",
        "service_provider": "Test Labs",
        "expiration_date": "2027-03-10",
    }
    resp_event = client.post("/events", json=event_data)
    event_id = resp_event.json()["id"]

    # 3. Add results
    results_to_add = [
        {"event_log_id": event_id, "tested_volume": 100.0, "measured_error": 0.5, "report_number": "R1"},
        {"event_log_id": event_id, "tested_volume": 100.0, "measured_error": 0.6, "report_number": "R1"},
        {"event_log_id": event_id, "tested_volume": 50.0, "measured_error": 0.2, "report_number": "R1"}
    ]
    
    for r in results_to_add:
        client.post("/results", json=r)
        
    # 4. Fetch results for event
    resp_results = client.get(f"/events/{event_id}/results")
    assert resp_results.status_code == 200
    
    results = resp_results.json()
    assert len(results) == 3
    # Check ordering (volume, then repetition_count) -> 50.0 first, then 100.0 repr 1, then 100.0 repr 2
    assert results[0]["tested_volume"] == 50.0
    assert results[0]["repetition_count"] == 1
    assert results[1]["tested_volume"] == 100.0
    assert results[1]["repetition_count"] == 1
    assert results[2]["tested_volume"] == 100.0
    assert results[2]["repetition_count"] == 2
