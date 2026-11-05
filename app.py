"""Hosting entrypoint (Vercel): the FastAPI app, imported through its package so relative imports resolve."""
from missiontwin.api import app  # noqa: F401
