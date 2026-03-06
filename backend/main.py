"""
Main entry point for the Pipette Calibration Manager backend.

This module defines the FastAPI application, route handlers, 
exception handlers, and the startup lifespan logic.
"""

import os
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import List

import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, and_, desc, func, select

from database import create_db_and_tables, engine, get_session
from models import (
    EventLog,
    EventLogCreate,
    GlobalSpecification,
    Pipette,
    PipetteCreate,
    PipetteStatus,
    Result,
    ResultCreate,
    Specification,
    SpecificationCreate,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles application startup and shutdown events.

    Performs database initialization and initial data import.
    """
    # Startup
    create_db_and_tables()
    initial_import()
    yield
    # Shutdown (if needed)


app = FastAPI(title="Gestor de Calibración de Pipetas", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def terminal_logging_middleware(request: Request, call_next):
    """
    Middleware to intercept and log terminal output for validation errors,
    successful insertions, and database exceptions.
    """
    response: Response = await call_next(request)

    if response.status_code == 201:
        print(f"[SUCCESS] 201 Created: {request.method} {request.url.path}")
    elif response.status_code == 400 or response.status_code == 422:
        print(f"[VALIDATION ERROR] {response.status_code}: {request.method} {request.url.path}")
    elif response.status_code == 409:
        print(f"[CONFLICT ERROR] 409 Conflict (Duplicate): {request.method} {request.url.path}")

    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler for the FastAPI application.

    Args:
        request (Request): The incoming request.
        exc (Exception): The unhandled exception.

    Returns:
        JSONResponse: A 500 Internal Server Error response with details.
    """
    print(f"[FATAL ERROR] {str(exc)}")
    import traceback

    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "message": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"},
    )


def map_status(status_str: str) -> PipetteStatus:
    """
    Maps legacy or CSV status strings to PipetteStatus enum.
    """
    if not isinstance(status_str, str):
        return PipetteStatus.EN_USO
    
    status_lower = status_str.lower()
    if "uso" in status_lower or "active" in status_lower:
        return PipetteStatus.EN_USO
    if "calibr" in status_lower:
        return PipetteStatus.CALIBRANDO
    if "fuera" in status_lower or "decommissioned" in status_lower:
        return PipetteStatus.FUERA_DE_USO
    return PipetteStatus.EN_USO


def initial_import():
    """
    Imports initial data from CSV files if the database is empty.

    Loads pipettes and global specifications from the 'data' directory.
    """
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    pipettes_csv = os.path.join(data_dir, "listado_pipetas.csv")
    specs_csv = os.path.join(data_dir, "especificacion_volumen.csv")

    with Session(engine) as session:
        # 1. Import Pipettes
        if os.path.exists(pipettes_csv):
            df_p = pd.read_csv(pipettes_csv, sep=";", encoding="utf-8")
            for _, row in df_p.iterrows():
                statement = select(Pipette).where(Pipette.codigo == row["codigo"])
                existing_pipette = session.exec(statement).first()
                status_mapped = map_status(row["Estado"])
                if existing_pipette:
                    existing_pipette.description = row["Descripción"]
                    existing_pipette.brand = row["Marca"]
                    existing_pipette.model = row["Modelo"]
                    existing_pipette.serial_number = str(row["N° Serie"])
                    existing_pipette.status = status_mapped
                    existing_pipette.max_volume = float(row["Volumen máximo"])
                    session.add(existing_pipette)
                else:
                    pipette = Pipette(
                        codigo=row["codigo"],
                        description=row["Descripción"],
                        brand=row["Marca"],
                        model=row["Modelo"],
                        serial_number=str(row["N° Serie"]),
                        status=status_mapped,
                        max_volume=float(row["Volumen máximo"]),
                    )
                    session.add(pipette)

        # 2. Import Global Specifications
        if os.path.exists(specs_csv):
            # Check if GlobalSpecification is already populated
            count_gs = session.exec(
                select(func.count()).select_from(GlobalSpecification)
            ).one()
            if count_gs == 0:
                print(f"Importing global specifications from {specs_csv}")
                df_s = pd.read_csv(specs_csv, sep=";", encoding="utf-8", decimal=",")
                for _, row in df_s.iterrows():
                    gs = GlobalSpecification(
                        vol_max=float(row["vol_max"]),
                        test_volume=float(row["volumen"]),
                        max_error_percent=float(row["especificacion_error"]),
                    )
                    session.add(gs)

        session.commit()


@app.get("/pipettes", response_model=List[Pipette])
def read_pipettes(session: Session = Depends(get_session)):
    """
    Retrieves all pipettes from the database.

    Returns:
        List[Pipette]: A list of all pipettes.
    """
    return session.exec(select(Pipette)).all()


@app.post("/api/v1/pipettes", response_model=Pipette, status_code=201)
def create_pipette(pipette_in: PipetteCreate, session: Session = Depends(get_session)):
    """
    Registers a new pipette in the system.

    Handles unique constraint violations for 'codigo' and 'serial_number'.

    Args:
        pipette_in (PipetteCreate): The pipette data.

    Returns:
        Pipette: The created pipette record.
    """
    try:
        db_pipette = Pipette.model_validate(pipette_in)
        session.add(db_pipette)
        session.commit()
        session.refresh(db_pipette)
        return db_pipette
    except IntegrityError as e:
        session.rollback()
        detail = str(e.orig)
        if "UNIQUE constraint failed" in detail:
            if "pipette.codigo" in detail:
                raise HTTPException(status_code=409, detail="Código ya registrado")
            if "pipette.serial_number" in detail:
                raise HTTPException(status_code=409, detail="Número de serie ya registrado")
        raise HTTPException(status_code=409, detail="Conflict: Duplicate data")


@app.get("/global-specifications", response_model=List[GlobalSpecification])
def read_global_specifications(session: Session = Depends(get_session)):
    """
    Retrieves all global (ISO/Standard) specifications.

    Returns:
        List[GlobalSpecification]: A list of all global specifications.
    """
    return session.exec(select(GlobalSpecification)).all()


@app.get("/global-specifications/{vol_max}", response_model=List[GlobalSpecification])
def read_global_specifications_by_vol_max(
    vol_max: float, session: Session = Depends(get_session)
):
    """
    Retrieves global specifications for a specific maximum volume.

    Args:
        vol_max (float): The maximum volume of the pipette category.

    Returns:
        List[GlobalSpecification]: A list of global specifications for the category.
    """
    return session.exec(
        select(GlobalSpecification).where(GlobalSpecification.vol_max == vol_max)
    ).all()


@app.get("/pipettes/{pipette_id}", response_model=Pipette)
def read_pipette(pipette_id: int, session: Session = Depends(get_session)):
    """
    Retrieves a single pipette by its ID.

    Args:
        pipette_id (int): The primary key ID of the pipette.

    Raises:
        HTTPException: If the pipette is not found.

    Returns:
        Pipette: The requested pipette object.
    """
    pipette = session.get(Pipette, pipette_id)
    if not pipette:
        raise HTTPException(status_code=404, detail="Pipette not found")
    return pipette


@app.put("/api/v1/pipettes/{pipette_id}/status", response_model=Pipette)
def update_pipette_status(
    pipette_id: int, new_status: PipetteStatus, session: Session = Depends(get_session)
):
    """
    Updates the status of a specific pipette.

    The audit log and last_status_change are handled by the database trigger.
    """
    db_pipette = session.get(Pipette, pipette_id)
    if not db_pipette:
        raise HTTPException(status_code=404, detail="Pipette not found")

    db_pipette.status = new_status
    session.add(db_pipette)
    session.commit()
    session.refresh(db_pipette)

    print(f"[STATUS UPDATE] Pipette {pipette_id} changed to {new_status}")
    return db_pipette


@app.post("/events", response_model=EventLog)
def create_event(event_in: EventLogCreate, session: Session = Depends(get_session)):
    """
    Registers a new event (calibration, etc.) for a pipette.

    Args:
        event_in (EventLogCreate): The event data to register.

    Returns:
        EventLog: The created event record.
    """
    db_event = EventLog.model_validate(event_in)
    session.add(db_event)
    session.commit()
    session.refresh(db_event)
    return db_event


@app.get("/events/{pipette_id}", response_model=List[EventLog])
def read_events(pipette_id: int, session: Session = Depends(get_session)):
    """
    Retrieves all events registered for a specific pipette.

    Args:
        pipette_id (int): The ID of the pipette.

    Returns:
        List[EventLog]: A list of events associated with the pipette.
    """
    return session.exec(select(EventLog).where(EventLog.pipette_id == pipette_id)).all()


@app.get("/pipettes/{pipette_id}/calibration-errors")
def get_calibration_errors(pipette_id: int, session: Session = Depends(get_session)):
    """
    Calculates calibration error trends for a specific pipette.

    Joins results, events, and specifications to determine error percentages
    and their corresponding limits.

    Args:
        pipette_id (int): The ID of the pipette.

    Returns:
        List[dict]: A list of data points containing date, volume, error, and limit.
    """
    # Explicitly select from Result and join EventLog and Pipette
    subquery = (
        select(
            EventLog.date_calibration,
            Result.tested_volume,
            Result.measured_error,
            Pipette.max_volume,
            func.row_number()
            .over(
                partition_by=(
                    EventLog.pipette_id,
                    Result.tested_volume,
                    EventLog.date_calibration,
                ),
                order_by=Result.id.desc(),
            )
            .label("rn"),
        )
        .select_from(Result)
        .join(EventLog)
        .join(Pipette, EventLog.pipette_id == Pipette.id)
        .where(EventLog.pipette_id == pipette_id)
        .subquery()
    )

    # Use COALESCE to prioritize Specific Specification over Global Specification
    query = (
        select(
            subquery.c.date_calibration,
            subquery.c.tested_volume,
            subquery.c.measured_error,
            func.coalesce(
                select(Specification.max_error)
                .where(
                    Specification.pipette_id == pipette_id,
                    Specification.volume == subquery.c.tested_volume,
                )
                .scalar_subquery(),
                select(GlobalSpecification.max_error_percent)
                .where(
                    GlobalSpecification.vol_max == subquery.c.max_volume,
                    GlobalSpecification.test_volume == subquery.c.tested_volume,
                )
                .scalar_subquery(),
            ).label("max_error_limit"),
        )
        .where(subquery.c.rn == 1)
        .order_by(subquery.c.date_calibration)
    )

    results = session.exec(query).all()

    print(
        f"SQLModel: Found {len(results)} distinct calibration error points for Pipette {pipette_id}"
    )

    return [
        {
            "date_calibration": row.date_calibration,
            "target_volume": row.tested_volume,
            "error_percent": row.measured_error,
            "max_error_limit": row.max_error_limit or 0.0,
        }
        for row in results
    ]


@app.post("/results", response_model=Result)
def create_result(result_in: ResultCreate, session: Session = Depends(get_session)):
    """
    Registers a new measurement result for a calibration event.

    Automatically calculates the repetition count and checks for 
    Out of Specification (OOS) status based on available limits.

    Args:
        result_in (ResultCreate): The measurement data.

    Raises:
        HTTPException: If the associated Event Log is not found.

    Returns:
        Result: The created and validated result record.
    """
    # 0. Log incoming data
    print(f"[API POST] /results - Payload: {result_in.model_dump()}")

    # 1. Verify if EventLog exists
    event = session.get(EventLog, result_in.event_log_id)
    if not event:
        print(f"[API ERROR] Event Log {result_in.event_log_id} not found")
        raise HTTPException(status_code=404, detail="Event Log not found")

    # 2. Automated repetition count
    count_statement = select(func.count(Result.id)).where(
        Result.event_log_id == result_in.event_log_id
    )
    rep_count = session.exec(count_statement).one() + 1

    # 3. OOS Calculation
    is_oos = False
    spec = session.exec(
        select(Specification).where(
            Specification.pipette_id == event.pipette_id,
            Specification.volume == result_in.tested_volume,
        )
    ).first()

    limit_percent = None
    if spec:
        limit_percent = spec.max_error
    else:
        # Fallback to GlobalSpecification (CSV data)
        pipette = session.get(Pipette, event.pipette_id)
        if pipette:
            gs = session.exec(
                select(GlobalSpecification).where(
                    GlobalSpecification.vol_max == pipette.max_volume,
                    GlobalSpecification.test_volume == result_in.tested_volume,
                )
            ).first()
            if gs:
                limit_percent = gs.max_error_percent

    if limit_percent is not None:
        # User requested to remove absolute value comparison and use relative error (%)
        is_oos = result_in.measured_error > limit_percent
        print(
            f"[DEBUG] OOS Check (Relative): error={result_in.measured_error}%, limit={limit_percent}%, result={is_oos}"
        )
    else:
        print(
            f"[DEBUG] No specification found for Pipette {event.pipette_id} Volume {result_in.tested_volume}"
        )

    # 4. Create and commit
    db_result = Result(
        **result_in.model_dump(exclude={"repetition_count"}),
        repetition_count=rep_count,
        is_oos=is_oos,
    )
    session.add(db_result)
    session.commit()
    session.refresh(db_result)

    # 5. CLI Logging
    print(
        f"[DB COMMIT] ResultID: {db_result.id}, EventLogID: {db_result.event_log_id}, Volume: {db_result.tested_volume}, Error: {db_result.measured_error}, Repetition: {db_result.repetition_count}, OOS: {db_result.is_oos}"
    )

    return db_result


@app.get("/pipettes/{pipette_id}/calibration-template", response_model=List[float])
def get_calibration_template(pipette_id: int, session: Session = Depends(get_session)):
    """
    Generates a calibration template based on the most recent event.

    Identifies the volumes tested in the last calibration to pre-populate 
    the next calibration form.

    Args:
        pipette_id (int): The ID of the pipette.

    Returns:
        List[float]: A list of volumes to be tested.
    """
    # 1. Fetch the most recent EventLog for the given pipette
    statement = (
        select(EventLog)
        .where(EventLog.pipette_id == pipette_id)
        .order_by(EventLog.date_calibration.desc(), EventLog.id.desc())
    )
    recent_event = session.exec(statement).first()

    if not recent_event:
        print(f"SQLModel: No previous events found for Pipette {pipette_id}")
        return []

    # 2. Fetch associated results and extract distinct target volumes
    # We use a set to ensure distinct values and then convert to a sorted list
    results_statement = select(Result.tested_volume).where(
        Result.event_log_id == recent_event.id
    )
    tested_volumes = session.exec(results_statement).all()

    distinct_volumes = sorted(list(set(tested_volumes)))

    print(
        f"SQLModel: Generated calibration template for Pipette {pipette_id} (EventLog ID: {recent_event.id}): {distinct_volumes}"
    )

    return distinct_volumes


@app.get("/api/pipettes/{pipette_id}/last-calibration-template")
def get_last_calibration_template(
    pipette_id: int, session: Session = Depends(get_session)
):
    """
    Version-controlled endpoint for retrieving the last calibration template.

    Args:
        pipette_id (int): The ID of the pipette.

    Returns:
        dict: A dictionary containing the list of volumes.
    """
    # Step A: Query the event_logs table
    statement = (
        select(EventLog)
        .where(EventLog.pipette_id == pipette_id)
        .order_by(EventLog.date_calibration.desc(), EventLog.id.desc())
    )
    recent_event = session.exec(statement).first()

    # Step B (Error Handling)
    if not recent_event:
        print(
            f"SQLModel: No previous history for Pipette {pipette_id}. Returning empty volumes."
        )
        return {"volumes": []}

    # Step C: Extract PK from the isolated event_log record
    event_pk = recent_event.id

    # Step D & E: Query resultados filtering by event_log_id and extract tested_volume
    results_statement = select(Result.tested_volume).where(
        Result.event_log_id == event_pk
    )
    tested_volumes = session.exec(results_statement).all()

    # Ensure distinct and sorted volumes
    distinct_volumes = sorted(list(set(tested_volumes)))

    # Step F: Return as clean JSON payload
    print(
        f"SQLModel: Isolated EventLog PK {event_pk} for Pipette {pipette_id}. Extracted volumes: {distinct_volumes}"
    )
    return {"volumes": distinct_volumes}


@app.get("/specifications/{pipette_id}", response_model=List[Specification])
def read_specifications(pipette_id: int, session: Session = Depends(get_session)):
    """
    Retrieves specific calibration limits (specifications) for a pipette.

    Args:
        pipette_id (int): The ID of the pipette.

    Returns:
        List[Specification]: A list of specifications.
    """
    return session.exec(
        select(Specification).where(Specification.pipette_id == pipette_id)
    ).all()


@app.post("/specifications", response_model=Specification)
def create_specification(
    spec_in: SpecificationCreate, session: Session = Depends(get_session)
):
    """
    Creates a new custom specification for a pipette.

    Args:
        spec_in (SpecificationCreate): The specification data.

    Returns:
        Specification: The created specification record.
    """
    db_spec = Specification.model_validate(spec_in)
    session.add(db_spec)
    session.commit()
    session.refresh(db_spec)
    return db_spec


@app.get("/alerts/expirations")
def get_expiration_alerts(days: int = 30, session: Session = Depends(get_session)):
    """
    Retrieves pipettes that are expiring soon.

    Args:
        days (int, optional): The threshold in days for expiration. Defaults to 30.

    Returns:
        List[dict]: A list of alerts with pipette details and days left.
    """
    threshold_date = date.today() + timedelta(days=days)

    # Subquery to isolate the latest calibration record for each pipette
    subquery = select(
        EventLog,
        func.row_number()
        .over(
            partition_by=EventLog.pipette_id, order_by=desc(EventLog.date_calibration)
        )
        .label("rn"),
    ).subquery()

    # Final statement filtering by the isolated records and expiration threshold
    statement = select(subquery).where(
        and_(subquery.c.rn == 1, subquery.c.expiration_date <= threshold_date)
    )

    # Terminal logging for SQL verification
    print("\n[QUERY LOG] Fetching latest expiration alerts:")
    print(statement.compile(compile_kwargs={"literal_binds": True}))

    expiring_events = session.execute(statement).all()

    alerts = []
    for event in expiring_events:
        pipette = session.get(Pipette, event.pipette_id)
        # Ensure date conversion if SQLite returns strings
        exp_date = event.expiration_date
        if isinstance(exp_date, str):
            exp_date = date.fromisoformat(exp_date)

        alerts.append(
            {
                "pipette_id": event.pipette_id,
                "pipette_codigo": pipette.codigo if pipette else "UNKNOWN",
                "type_event": event.type_event,
                "expiration_date": exp_date,
                "days_left": (exp_date - date.today()).days,
            }
        )
    return alerts


@app.get("/dashboard/stats")
def get_dashboard_stats(session: Session = Depends(get_session)):
    """
    Retrieves summary statistics for the dashboard.

    Calculates total pipettes, total events, and number of expiring pipettes.

    Returns:
        dict: A dictionary of statistics.
    """
    total_pipettes = len(session.exec(select(Pipette)).all())
    total_events = len(session.exec(select(EventLog)).all())
    threshold_date = date.today() + timedelta(days=30)

    # Same aggregation logic for consistent stats
    subquery = select(
        EventLog.pipette_id,
        EventLog.expiration_date,
        func.row_number()
        .over(
            partition_by=EventLog.pipette_id, order_by=desc(EventLog.date_calibration)
        )
        .label("rn"),
    ).subquery()

    count_statement = (
        select(func.count())
        .select_from(subquery)
        .where(and_(subquery.c.rn == 1, subquery.c.expiration_date <= threshold_date))
    )
    expiring_count = session.exec(count_statement).one()

    return {
        "total_pipettes": total_pipettes,
        "total_events": total_events,
        "expiring_soon": expiring_count,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
