import os
import click
from flask import Flask, jsonify
from backend.extensions import db, migrate, jwt, cors
from backend.routes import auth, portal
from backend.models import RoleEnum, User
from werkzeug.security import generate_password_hash
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

def create_app():
    app = Flask(__name__)
    os.makedirs(app.instance_path, exist_ok=True)
    # Load configuration from environment or .env file
    app.config.from_object('backend.config.Config')

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app)

    # Register blueprints
    app.register_blueprint(auth.bp, url_prefix='/api/auth')
    app.register_blueprint(portal.bp, url_prefix='/api/portal')

    @app.route('/')
    def index():
        return jsonify({"message": "Student Study Planner API"}), 200

    @app.route('/api/health')
    def health():
        try:
            db.session.execute(text("SELECT 1"))
        except SQLAlchemyError as error:
            db.session.rollback()
            app.logger.error("Database health check failed (%s)", type(error).__name__)
            return jsonify({
                "status": "error",
                "database": "unavailable",
                "message": "Check the backend database URL, Supabase network access, and pooler settings.",
            }), 503
        return jsonify({"status": "ok", "database": "connected"}), 200

    @app.errorhandler(SQLAlchemyError)
    def database_error(error):
        db.session.rollback()
        app.logger.error("Database request failed (%s)", type(error).__name__)
        return jsonify({
            "error": "The database is unavailable. Check the backend DATABASE_URL and Supabase network or pooler settings.",
        }), 503

    @app.cli.command("create-admin")
    @click.option("--email", prompt=True)
    @click.option("--name", prompt="Admin full name")
    def create_admin(email, name):
        """Create an admin account from the server command line."""
        email = email.strip()
        name = name.strip()
        if not email or not name:
            raise click.ClickException("Admin name and email are required.")
        if User.query.filter_by(email=email).first():
            raise click.ClickException("That email address already has an account.")
        password = click.prompt("Admin password", hide_input=True, confirmation_prompt=True)
        if len(password) < 12 or len(password) > 128:
            raise click.ClickException("Admin password must be between 12 and 128 characters.")
        db.session.add(User(
            role=RoleEnum.ADMIN,
            full_name=name,
            email=email,
            password_hash=generate_password_hash(password),
        ))
        db.session.commit()
        click.echo(f"Admin account created for {email}.")

    return app

if __name__ == "__main__":
    flask_app = create_app()
    # Enable debug mode when FLASK_DEBUG env var is set
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    flask_app.run(host='0.0.0.0', port=int(os.getenv("PORT", 5000)), debug=debug)
