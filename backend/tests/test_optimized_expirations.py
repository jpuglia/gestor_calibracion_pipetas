from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from models import EventLog, Pipette


def test_optimized_expiration_alerts_only_latest(client: TestClient, session: Session):
    # Setup: 1 Pipette
    pipette = Pipette(
        codigo="PP-OPT-1",
        description="Optimized Test",
        brand="Brand",
        model="Model",
        serial_number="SN-OPT",
        status="En Uso",
        max_volume=100.0,
    )
    session.add(pipette)
    session.commit()
    session.refresh(pipette)

    # Scenario 1: Older record is expiring, but latest record is NOT expiring
    # Old record (Expired/Expiring)
    old_event = EventLog(
        pipette_id=pipette.id,
        type_event="calibración",
        date_calibration=date.today() - timedelta(days=365),
        service_provider="Old Provider",
        expiration_date=date.today()
        + timedelta(days=5),  # Should trigger if not optimized
    )
    session.add(old_event)

    # Latest record (Not expiring)
    latest_event = EventLog(
        pipette_id=pipette.id,
        type_event="calibración",
        date_calibration=date.today(),
        service_provider="New Provider",
        expiration_date=date.today() + timedelta(days=365),  # Should NOT trigger
    )
    session.add(latest_event)
    session.commit()

    # Assert: 0 alerts should be returned because the LATEST record is NOT expiring
    response = client.get("/alerts/expirations?days=30")
    assert response.status_code == 200
    alerts = response.json()
    assert len(alerts) == 0

    # Scenario 2: Latest record IS expiring
    # Add a newer record that is expiring
    new_expiring_event = EventLog(
        pipette_id=pipette.id,
        type_event="calificación",
        date_calibration=date.today() + timedelta(days=1),
        service_provider="Newest Provider",
        expiration_date=date.today() + timedelta(days=10),  # Should trigger
    )
    session.add(new_expiring_event)
    session.commit()

    # Assert: 1 alert should be returned (the latest one)
    response = client.get("/alerts/expirations?days=30")
    assert response.status_code == 200
    alerts = response.json()
    assert len(alerts) == 1
    assert alerts[0]["pipette_id"] == pipette.id
    assert alerts[0]["type_event"] == "calificación"


def test_dashboard_stats_consistency(client: TestClient, session: Session):
    # Setup: 2 Pipettes
    p1 = Pipette(
        codigo="P1",
        description="D",
        brand="B",
        model="M",
        serial_number="S1",
        status="En Uso",
        max_volume=100.0,
    )
    p2 = Pipette(
        codigo="P2",
        description="D",
        brand="B",
        model="M",
        serial_number="S2",
        status="En Uso",
        max_volume=10,
    )
    session.add(p1)
    session.add(p2)
    session.commit()

    # P1: Latest is expiring
    session.add(
        EventLog(
            pipette_id=p1.id,
            type_event="C",
            date_calibration=date.today(),
            service_provider="S",
            expiration_date=date.today() + timedelta(days=5),
        )
    )

    # P2: Old is expiring, Latest is NOT
    session.add(
        EventLog(
            pipette_id=p2.id,
            type_event="C",
            date_calibration=date.today() - timedelta(days=10),
            service_provider="S",
            expiration_date=date.today() + timedelta(days=5),
        )
    )
    session.add(
        EventLog(
            pipette_id=p2.id,
            type_event="C",
            date_calibration=date.today(),
            service_provider="S",
            expiration_date=date.today() + timedelta(days=100),
        )
    )

    session.commit()

    # Dashboard stats should show only 1 expiring soon (P1)
    response = client.get("/dashboard/stats")
    assert response.status_code == 200
    stats = response.json()
    assert stats["expiring_soon"] == 1
