import os
import secrets
import ssl
from dotenv import load_dotenv
from sqlalchemy.engine import make_url

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

database_url = os.getenv("DATABASE_URL") or "sqlite:///student_study_planner.db"
engine_options = {}
if database_url.startswith(("postgres://", "postgresql://", "postgresql+pg8000://")):
    url = make_url(database_url)
    query = dict(url.query)
    sslmode = query.pop("sslmode", None)
    if url.drivername in ("postgres", "postgresql"):
        url = url.set(drivername="postgresql+pg8000")
    database_url = url.set(query=query)
    engine_options["connect_args"] = {"timeout": 5}
    engine_options["pool_pre_ping"] = True
    if sslmode and sslmode.lower() != "disable":
        engine_options["connect_args"]["ssl_context"] = ssl.create_default_context()

class Config:
    """Base configuration for Flask app"""
    # General Flask settings
    DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"
    if not DEBUG and (not os.getenv("FLASK_SECRET_KEY") or not os.getenv("JWT_SECRET_KEY")):
        raise RuntimeError("Set FLASK_SECRET_KEY and JWT_SECRET_KEY before running outside debug mode.")
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(32)

    # Database configuration – Supabase PostgreSQL URL
    # Example: postgresql://username:password@host:5432/database
    # Use a local SQLite database by default; DATABASE_URL can override it.
    SQLALCHEMY_DATABASE_URI = database_url
    SQLALCHEMY_ENGINE_OPTIONS = engine_options
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT configuration
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or secrets.token_hex(32)
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_COOKIE_SECURE = os.getenv("JWT_COOKIE_SECURE", "0" if DEBUG else "1") == "1"
    JWT_COOKIE_SAMESITE = "Lax"
    JWT_ACCESS_COOKIE_PATH = '/'  # cookie valid for entire site
    JWT_REFRESH_COOKIE_PATH = '/'  # optional
    JWT_COOKIE_CSRF_PROTECT = True

    # CORS settings
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
