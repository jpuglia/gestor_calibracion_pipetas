import os
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

# Get the path to the project root (one level up from this file)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sqlite_file_name = os.path.join(BASE_DIR, "pipettes.db")
sqlite_url = f"sqlite:///{sqlite_file_name}"

# Enable Connection Pooling (QueuePool for file-based SQLite)
engine = create_engine(
    sqlite_url,
    echo=True,
    connect_args={"check_same_thread": False},  # Allow multi-threaded access
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """
    Enables Write-Ahead Logging (WAL) mode for the SQLite database 
    on every new connection. This allows simultaneous reads and 
    significantly improves concurrency for multiple users.
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
