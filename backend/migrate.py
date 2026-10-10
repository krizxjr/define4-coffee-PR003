<<<<<<< HEAD
"""Apply additive PostgreSQL schema changes for per-user Open Attic workspaces.

Run from this directory after configuring backend/.env:
    python migrate.py

Existing data is deliberately left unassigned by default. To move all legacy rows
into one existing Supabase Auth account, temporarily set LEGACY_DATA_OWNER_ID to
that account's user UUID in the backend environment before running the migration.
"""
import os
import uuid
=======
"""Apply additive LearnHub schema updates to an existing database.

Run after configuring DATABASE_URL: python migrate.py
For Supabase PostgreSQL, schema.sql can also be run in the Supabase SQL Editor.
"""
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
from sqlalchemy import inspect, text
from app import create_app, db

app = create_app()

<<<<<<< HEAD

def quote_ident(value):
    return '"' + value.replace('"', '""') + '"'


with app.app_context():
    db.create_all()
    dialect = db.engine.dialect.name
    inspector = inspect(db.engine)
    tables = set(inspector.get_table_names())
    owner_tables = ("subjects", "topics", "resources")

    with db.engine.begin() as connection:
        for table in owner_tables:
            if table not in tables:
                continue
            columns = {column["name"] for column in inspect(connection).get_columns(table)}
            if "owner_id" not in columns:
                connection.execute(text(f"ALTER TABLE {quote_ident(table)} ADD COLUMN owner_id VARCHAR(36)"))
                print(f"Added {table}.owner_id")

        if dialect == "postgresql":
            # Older schema versions made subject names globally unique. Drop any
            # one-column unique constraint on `name`, regardless of its generated name.
            refreshed = inspect(connection)
            for constraint in refreshed.get_unique_constraints("subjects"):
                if constraint.get("column_names") == ["name"] and constraint.get("name"):
                    connection.execute(text(
                        f"ALTER TABLE subjects DROP CONSTRAINT IF EXISTS {quote_ident(constraint['name'])}"
                    ))
                    print(f"Dropped old global subject-name constraint: {constraint['name']}")

            # Drop a standalone unique index on name too, if an older schema used one.
            refreshed = inspect(connection)
            for index in refreshed.get_indexes("subjects"):
                if index.get("unique") and index.get("column_names") == ["name"] and index.get("name"):
                    connection.execute(text(f"DROP INDEX IF EXISTS {quote_ident(index['name'])}"))
                    print(f"Dropped old global subject-name index: {index['name']}")

            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_subjects_name ON subjects (name)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_subjects_owner_id ON subjects (owner_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_topics_owner_id ON topics (owner_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_resources_owner_id ON resources (owner_id)"))
            constraints = {item.get("name") for item in inspect(connection).get_unique_constraints("subjects")}
            if "uq_subject_owner_name" not in constraints:
                connection.execute(text(
                    "ALTER TABLE subjects ADD CONSTRAINT uq_subject_owner_name UNIQUE (owner_id, name)"
                ))
        else:
            print(
                "WARNING: this migration is designed for Supabase/PostgreSQL. "
                "SQLite can add owner_id columns but cannot easily remove the old global unique constraint. "
                "For an existing SQLite database, back it up and migrate to the included PostgreSQL schema."
            )

        legacy_owner = os.getenv("LEGACY_DATA_OWNER_ID", "").strip()
        if legacy_owner:
            try:
                legacy_owner = str(uuid.UUID(legacy_owner))
            except ValueError as exc:
                raise SystemExit("LEGACY_DATA_OWNER_ID must be the UUID of an existing Supabase Auth user.") from exc
            for table in owner_tables:
                if table in tables:
                    connection.execute(text(
                        f"UPDATE {quote_ident(table)} SET owner_id = :owner_id WHERE owner_id IS NULL"
                    ), {"owner_id": legacy_owner})
            print(f"Assigned previously unowned legacy rows to Supabase user {legacy_owner}.")
        else:
            print("Legacy rows remain unassigned and invisible to signed-in users (privacy-safe default).")

        # Preserve the ownership chain: topic belongs to its subject owner, and
        # resource belongs to its topic owner. This also repairs partial earlier
        # migrations without making unassigned legacy rows visible.
        if dialect == "postgresql":
            connection.execute(text("""
                UPDATE topics AS t SET owner_id = s.owner_id
                FROM subjects AS s
                WHERE t.subject_id = s.id
                  AND s.owner_id IS NOT NULL
                  AND t.owner_id IS DISTINCT FROM s.owner_id
            """))
            connection.execute(text("""
                UPDATE resources AS r SET owner_id = t.owner_id
                FROM topics AS t
                WHERE r.topic_id = t.id
                  AND t.owner_id IS NOT NULL
                  AND r.owner_id IS DISTINCT FROM t.owner_id
            """))

    print("Per-user workspace migration complete.")
=======
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
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
