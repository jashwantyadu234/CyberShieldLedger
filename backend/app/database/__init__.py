import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Use SQLite by default — no Docker, no server, zero config.
# The database file lives at backend/cybershield.db
DB_DIR = Path(__file__).resolve().parents[2]

# SQLite is the supported demo database. A custom SQLite URL or file path is
# accepted so the service behaves consistently from any working directory.
_overridden = os.getenv("DATABASE_URL", "")
_sqlite_path = os.getenv("SQLITE_DB_PATH", "")
if _overridden and not _overridden.startswith("sqlite"):
    print("⚠️  Non-SQLite DATABASE_URL ignored in the local demo configuration")
    DATABASE_URL = f"sqlite:///{Path(_sqlite_path) if _sqlite_path else DB_DIR / 'cybershield.db'}"
elif _overridden:
    DATABASE_URL = _overridden
else:
    DATABASE_URL = f"sqlite:///{Path(_sqlite_path) if _sqlite_path else DB_DIR / 'cybershield.db'}"

# SQLite needs check_same_thread=False since FastAPI uses multiple threads
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
