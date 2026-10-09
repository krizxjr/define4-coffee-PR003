"""Apply additive LearnHub schema updates to an existing database.

Run after configuring DATABASE_URL: python migrate.py
For Supabase PostgreSQL, schema.sql can also be run in the Supabase SQL Editor.
"""
from sqlalchemy import inspect, text
from app import create_app, db

app = create_app()

with app.app_context():
    inspector = inspect(db.engine)
    if "resources" not in inspector.get_table_names():
        db.create_all()
        inspector = inspect(db.engine)

    existing = {column["name"] for column in inspector.get_columns("resources")}
    additions = {
        "storage_bucket": "VARCHAR(120)",
        "file_name": "VARCHAR(255)",
        "mime_type": "VARCHAR(180)",
        "file_size": "BIGINT",
    }
    with db.engine.begin() as connection:
        for column, sql_type in additions.items():
            if column not in existing:
                connection.execute(text(f"ALTER TABLE resources ADD COLUMN {column} {sql_type}"))
                print(f"Added resources.{column}")
    print("LearnHub database migration complete.")
