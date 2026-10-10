import os
from datetime import datetime, timezone
from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()
db = SQLAlchemy()


def create_app():
    app = Flask(__name__)
    database_url = os.getenv("DATABASE_URL", "sqlite:///learnhub_dev.db")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

    app.config.update(
        SQLALCHEMY_DATABASE_URI=database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        MAX_CONTENT_LENGTH=int(os.getenv("MAX_CONTENT_LENGTH_MB", "50")) * 1024 * 1024,
        JSON_SORT_KEYS=False,
    )
<<<<<<< HEAD
    origins = [x.strip() for x in os.getenv("FRONTEND_ORIGINS", "http://localhost:4173,http://127.0.0.1:4173").split(",") if x.strip()]
=======
    origins = [x.strip() for x in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
    CORS(app, resources={r"/api/*": {"origins": origins}}, supports_credentials=False)
    db.init_app(app)

    from . import models  # noqa: F401
    from .routes import api
    app.register_blueprint(api, url_prefix="/api")

    @app.get("/")
    def index():
        return jsonify({"name": "LearnHub API", "status": "ok", "api": "/api/health"})

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify({"error": "File is too large", "max_mb": app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)}), 413

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"error": getattr(error, "description", "Bad request")}), 400

    @app.errorhandler(500)
    def server_error(_error):
        db.session.rollback()
        app.logger.exception("Unhandled server error")
        return jsonify({"error": "Internal server error"}), 500

    if os.getenv("AUTO_CREATE_TABLES", "true").lower() == "true":
        with app.app_context():
            db.create_all()

    return app
