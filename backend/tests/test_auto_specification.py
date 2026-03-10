from fastapi.testclient import TestClient
from sqlmodel import Session, select
from models import Pipette, Specification, GlobalSpecification

def test_auto_specification_assignment(client: TestClient, session: Session):
    # 1. Setup: Ensure there are global specifications for 1000uL
    gs1 = GlobalSpecification(vol_max=1000.0, test_volume=1000.0, max_error_percent=0.8)
    gs2 = GlobalSpecification(vol_max=1000.0, test_volume=500.0, max_error_percent=1.6)
    gs3 = GlobalSpecification(vol_max=1000.0, test_volume=100.0, max_error_percent=8.0)
    session.add(gs1)
    session.add(gs2)
    session.add(gs3)
    session.commit()

    # 2. Action: Create a new pipette with max_volume 1000.0 via the API
    pipette_data = {
        "codigo": "PP-AUTO-SPEC",
        "description": "Auto Spec Test Pipette",
        "brand": "Brand",
        "model": "Model",
        "serial_number": "SN-AUTO-001",
        "status": "En Uso",
        "max_volume": 1000.0
    }
    response = client.post("/api/v1/pipettes", json=pipette_data)
    assert response.status_code == 201
    created_pipette = response.json()
    pipette_id = created_pipette["id"]

    # 3. Verification: Check if Specification records were created automatically
    statement = select(Specification).where(Specification.pipette_id == pipette_id)
    specs = session.exec(statement).all()
    
    assert len(specs) == 3
    
    volumes = {s.volume for s in specs}
    assert volumes == {1000.0, 500.0, 100.0}
    
    for s in specs:
        if s.volume == 1000.0:
            assert s.max_error == 0.8
        elif s.volume == 500.0:
            assert s.max_error == 1.6
        elif s.volume == 100.0:
            assert s.max_error == 8.0
