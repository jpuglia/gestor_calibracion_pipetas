"""
Database models for the Pipette Calibration Manager.

This module defines the SQLModel schemas for pipettes, specifications, 
event logs, and calibration results.
"""

from datetime import date, datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import Column, Enum as SAEnum
from sqlmodel import Field, Index, Relationship, SQLModel, desc


class PipetteStatus(str, Enum):
    """Predefined status values for a Pipette."""

    EN_USO = "En Uso"
    CALIBRANDO = "Calibrando"
    FUERA_DE_USO = "Fuera de uso"


class PipetteBase(SQLModel):
    """Base schema for a Pipette."""

    codigo: str = Field(
        index=True, unique=True, description="Unique identifier code for the pipette"
    )
    description: Optional[str] = Field(
        default=None, max_length=500, description="Brief description of the pipette"
    )
    brand: str = Field(min_length=1, description="Manufacturer brand")
    model: str = Field(min_length=1, description="Pipette model name")
    serial_number: str = Field(
        unique=True, min_length=1, description="Physical serial number"
    )
    status: str = Field(
        default=PipetteStatus.EN_USO.value,
        description="Current status (restricted to 'En Uso', 'Calibrando', 'Fuera de uso')",
    )
    last_status_change: datetime = Field(
        default_factory=datetime.now,
        description="Timestamp of the last status change",
    )
    max_volume: float = Field(gt=0, description="Maximum nominal volume in microliters")


class Pipette(PipetteBase, table=True):
    """Database table for Pipettes."""

    id: Optional[int] = Field(default=None, primary_key=True)

    specifications: List["Specification"] = Relationship(back_populates="pipette")
    events: List["EventLog"] = Relationship(back_populates="pipette")
    status_history: List["StatusAuditLog"] = Relationship(back_populates="pipette")


class StatusAuditLog(SQLModel, table=True):
    """Audit log for pipette status changes."""

    id: Optional[int] = Field(default=None, primary_key=True)
    pipette_id: int = Field(
        foreign_key="pipette.id", description="Reference to the pipette"
    )
    old_status: str = Field(description="Previous status value")
    new_status: str = Field(description="New status value")
    change_date: datetime = Field(
        default_factory=datetime.now, description="When the change occurred"
    )

    pipette: Pipette = Relationship(back_populates="status_history")


class PipetteCreate(PipetteBase):
    """Schema for creating a new Pipette."""

    pass


class SpecificationBase(SQLModel):
    """Base schema for a Pipette Specification."""

    pipette_id: int = Field(
        foreign_key="pipette.id", description="Reference to the pipette"
    )
    volume: float = Field(description="Test volume for this specification")
    max_error: float = Field(
        description="Maximum allowed error percentage for this volume"
    )


class Specification(SpecificationBase, table=True):
    """Database table for Pipette Specifications."""

    id: Optional[int] = Field(default=None, primary_key=True)

    pipette: Pipette = Relationship(back_populates="specifications")


class SpecificationCreate(SpecificationBase):
    """Schema for creating a new Specification."""

    pass


class GlobalSpecification(SQLModel, table=True):
    """
    Database table for Global Specifications (ISO/Standard).

    These are fallback specifications used when a pipette-specific
    specification is not available.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    vol_max: float = Field(
        index=True, description="Maximum volume of the pipette category"
    )
    test_volume: float = Field(description="Test volume for this standard")
    max_error_percent: float = Field(
        description="Allowed error percentage for this standard"
    )


class EventLogBase(SQLModel):
    """Base schema for an Event Log (Calibration, Qualification, etc.)."""

    pipette_id: int = Field(
        foreign_key="pipette.id", description="Reference to the pipette"
    )
    type_event: str = Field(
        description="Type of event: 'calibración', 'calificación', or 'ajuste'"
    )
    date_calibration: date = Field(description="Date when the event took place")
    service_provider: str = Field(description="Entity that performed the service")
    expiration_date: date = Field(description="Next scheduled service date")


class EventLog(EventLogBase, table=True):
    """Database table for Event Logs."""

    __table_args__ = (
        Index("idx_pipette_date_desc", "pipette_id", desc("date_calibration")),
    )
    id: Optional[int] = Field(default=None, primary_key=True)

    pipette: Pipette = Relationship(back_populates="events")
    results: List["Result"] = Relationship(back_populates="event")


class EventLogCreate(EventLogBase):
    """Schema for creating a new Event Log."""

    pass


class ResultBase(SQLModel):
    """Base schema for a Calibration Result point."""

    event_log_id: int = Field(
        foreign_key="eventlog.id", description="Reference to the event log"
    )
    tested_volume: float = Field(description="Target volume tested during calibration")
    measured_error: float = Field(description="Measured error percentage")
    report_number: str = Field(description="Certificate or report identifier")


class Result(ResultBase, table=True):
    """Database table for Calibration Results."""

    id: Optional[int] = Field(default=None, primary_key=True)
    repetition_count: int = Field(
        description="Sequential number of the measurement for this volume"
    )
    is_oos: bool = Field(
        default=False, description="Whether the result is Out of Specification"
    )

    event: EventLog = Relationship(back_populates="results")


class ResultCreate(ResultBase):
    """Schema for creating a new Result."""

    repetition_count: Optional[int] = None
