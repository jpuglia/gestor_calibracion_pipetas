from fastapi.testclient import TestClient
from sqlmodel import Session

from models import Pipette


def test_measured_error_precision(client: TestClient, session: Session):
    """Verify that floating point precision is maintained for error measurements."""
    # Setup pipette and event
    pipette = Pipette(
        codigo="PRECISION-TEST",
        description="Test",
        brand="Brand",
        model="Model",
        serial_number="SN",
        status="En Uso",
        max_volume=100.0,
    )
    session.add(pipette)
    session.commit()
    session.refresh(pipette)

    event_data = {
        "pipette_id": pipette.id,
        "type_event": "calibración",
        "date_calibration": "2026-03-05",
        "service_provider": "Test Labs",
        "expiration_date": "2027-03-05",
    }
    event_resp = client.post("/events", json=event_data)
    event_id = event_resp.json()["id"]

    # Precision Value (Microliters usually don't have this many, but good for test)
    high_precision_error = 0.355123456789

    result_data = {
        "event_log_id": event_id,
        "tested_volume": 100.0,
        "measured_error": high_precision_error,
        "report_number": "REP-PRECISION",
    }

    # Save result
    save_resp = client.post("/results", json=result_data)
    assert save_resp.status_code == 200

    # Check response value
    assert save_resp.json()["measured_error"] == high_precision_error

    # Verify retrieval from aggregation endpoint
    agg_resp = client.get(f"/pipettes/{pipette.id}/calibration-errors")
    assert agg_resp.status_code == 200
    agg_data = agg_resp.json()
    assert len(agg_data) == 1
    assert agg_data[0]["error_percent"] == high_precision_error


def test_oos_flagging_logic(client: TestClient, session: Session):
    """Verify that is_oos is correctly flagged based on specifications."""
    # Setup pipette
    pipette = Pipette(
        codigo="OOS-TEST",
        description="Test",
        brand="Brand",
        model="Model",
        serial_number="SN",
        status="En Uso",
        max_volume=100.0,
    )
    session.add(pipette)
    session.commit()
    session.refresh(pipette)

    # 1. Create a specification: 100µL, max_error = 0.5
    spec_data = {"pipette_id": pipette.id, "volume": 100.0, "max_error": 0.5}
    client.post("/specifications", json=spec_data)

    # Create event
    event_resp = client.post(
        "/events",
        json={
            "pipette_id": pipette.id,
            "type_event": "calibración",
            "date_calibration": "2026-03-05",
            "service_provider": "Test Labs",
            "expiration_date": "2027-03-05",
        },
    )
    event_id = event_resp.json()["id"]

    # 2. Test FAIL (OOS = True)
    fail_result = {
        "event_log_id": event_id,
        "tested_volume": 100.0,
        "measured_error": 0.51,  # Over 0.5
        "report_number": "REP-FAIL",
    }
    fail_resp = client.post("/results", json=fail_result)
    assert fail_resp.json()["is_oos"] is True

    # 3. Test PASS (OOS = False)
    pass_result = {
        "event_log_id": event_id,
        "tested_volume": 100.0,
        "measured_error": 0.49,  # Under 0.5
        "report_number": "REP-PASS",
    }
    pass_resp = client.post("/results", json=pass_result)
    assert pass_resp.json()["is_oos"] is False

    # 4. Test BORDERLINE (OOS = False, abs calculation)
    border_result = {
        "event_log_id": event_id,
        "tested_volume": 100.0,
        "measured_error": -0.5,  # Exactly at the limit (abs)
        "report_number": "REP-BORDER",
    }
    border_resp = client.post("/results", json=border_result)
    assert (
        border_resp.json()["is_oos"] is False
    )  # is abs(err) > max_error (abs(-0.5) > 0.5 is False)

    # 4.5 Test NEGATIVE OOS (OOS = True)
    neg_oos_result = {
        "event_log_id": event_id,
        "tested_volume": 100.0,
        "measured_error": -0.51,  # Over 0.5 when abs is taken
        "report_number": "REP-NEG",
    }
    neg_oos_resp = client.post("/results", json=neg_oos_result)
    assert neg_oos_resp.json()["is_oos"] is True

    # 5. Test NO SPEC (OOS = False)
    no_spec_result = {
        "event_log_id": event_id,
        "tested_volume": 50.0,  # No specification for 50uL
        "measured_error": 10.0,
        "report_number": "REP-NO-SPEC",
    }
    no_spec_resp = client.post("/results", json=no_spec_result)
    assert no_spec_resp.json()["is_oos"] is False
