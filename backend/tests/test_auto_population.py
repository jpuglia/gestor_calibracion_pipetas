from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from main import app, get_session
from models import EventLog, Pipette, Result


# Setup in-memory database for testing
@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_get_calibration_template(client: TestClient, session: Session):
    # 1. Create a pipette
    pipette = Pipette(
        codigo="P1000",
        description="Pipeta de prueba",
        brand="BrandX",
        model="M1",
        serial_number="SN123",
        status="En Uso",
        max_volume=1000.0,
    )
    session.add(pipette)
    session.commit()
    session.refresh(pipette)

    # 2. Create an event and results
    event1 = EventLog(
        pipette_id=pipette.id,
        type_event="calibración",
        date_calibration=date(2023, 1, 1),
        service_provider="Provider A",
        expiration_date=date(2024, 1, 1),
    )
    session.add(event1)
    session.commit()
    session.refresh(event1)

    res1 = Result(
        event_log_id=event1.id,
        tested_volume=100.0,
        measured_error=0.5,
        report_number="R1",
        repetition_count=1,
    )
    res2 = Result(
        event_log_id=event1.id,
        tested_volume=500.0,
        measured_error=1.0,
        report_number="R1",
        repetition_count=1,
    )
    res3 = Result(
        event_log_id=event1.id,
        tested_volume=1000.0,
        measured_error=2.0,
        report_number="R1",
        repetition_count=1,
    )
    session.add(res1)
    session.add(res2)
    session.add(res3)
    session.commit()

    # 3. Create a more recent event with different volumes
    event2 = EventLog(
        pipette_id=pipette.id,
        type_event="calibración",
        date_calibration=date(2023, 6, 1),
        service_provider="Provider B",
        expiration_date=date(2024, 6, 1),
    )
    session.add(event2)
    session.commit()
    session.refresh(event2)

    res4 = Result(
        event_log_id=event2.id,
        tested_volume=200.0,
        measured_error=0.6,
        report_number="R2",
        repetition_count=1,
    )
    res5 = Result(
        event_log_id=event2.id,
        tested_volume=600.0,
        measured_error=1.2,
        report_number="R2",
        repetition_count=1,
    )
    session.add(res4)
    session.add(res5)
    session.commit()

    # 4. Test the endpoint
    response = client.get(f"/pipettes/{pipette.id}/calibration-template")
    assert response.status_code == 200
    data = response.json()

    # Should return volumes from the most recent event (event2)
    assert len(data) == 2
    assert 200.0 in data
    assert 600.0 in data
    assert 100.0 not in data


def test_get_calibration_template_no_history(client: TestClient, session: Session):
    # 1. Create a pipette with no history
    pipette = Pipette(
        codigo="PEMPTY",
        description="Pipeta sin historial",
        brand="BrandY",
        model="M2",
        serial_number="SN456",
        status="En Uso",
        max_volume=500.0,
    )
    session.add(pipette)
    session.commit()
    session.refresh(pipette)

    # 2. Test the endpoint
    response = client.get(f"/pipettes/{pipette.id}/calibration-template")
    assert response.status_code == 200
    data = response.json()
    assert data == []


def test_get_last_calibration_template_api(client: TestClient, session: Session):
    # 1. Create a pipette with history
    pipette = Pipette(
        codigo="P2000",
        description="Test",
        brand="X",
        model="M",
        serial_number="S1",
        status="En Uso",
        max_volume=2000.0,
    )
    session.add(pipette)
    session.commit()
    session.refresh(pipette)

    # 2. Create an event (PK will be used)
    event = EventLog(
        pipette_id=pipette.id,
        type_event="calibración",
        date_calibration=date(2023, 1, 1),
        service_provider="P1",
        expiration_date=date(2024, 1, 1),
    )
    session.add(event)
    session.commit()
    session.refresh(event)

    # 3. Add results
    session.add(
        Result(
            event_log_id=event.id,
            tested_volume=500.0,
            measured_error=0.1,
            report_number="REP1",
            repetition_count=1,
        )
    )
    session.add(
        Result(
            event_log_id=event.id,
            tested_volume=1000.0,
            measured_error=0.2,
            report_number="REP1",
            repetition_count=1,
        )
    )
    session.commit()

    # 4. Test the new /api endpoint
    response = client.get(f"/api/pipettes/{pipette.id}/last-calibration-template")
    assert response.status_code == 200
    data = response.json()
    assert "volumes" in data
    assert data["volumes"] == [500.0, 1000.0]


def test_get_last_calibration_template_api_no_history(
    client: TestClient, session: Session
):
    # 1. Create a pipette with no history
    pipette = Pipette(
        codigo="PNEW",
        description="Test",
        brand="X",
        model="M",
        serial_number="S2",
        status="En Uso",
        max_volume=1000.0,
    )
    session.add(pipette)
    session.commit()
    session.refresh(pipette)

    # 2. Test the new /api endpoint
    response = client.get(f"/api/pipettes/{pipette.id}/last-calibration-template")
    assert response.status_code == 200
    data = response.json()
    assert data == {"volumes": []}
