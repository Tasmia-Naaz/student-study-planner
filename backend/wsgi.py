# backend/wsgi.py
"""WSGI entry point for the Flask application.
Flask's CLI looks for an object named ``app`` when the ``FLASK_APP``
environment variable points to this module.
"""

from .app import create_app

# The Flask app instance used by ``flask run`` and any WSGI server.
app = create_app()

