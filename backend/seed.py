"""Seed demo resources for one explicit Supabase Auth user. Set SEED_OWNER_ID first."""
import os
from app import create_app, db
from app.models import Subject, Topic, Resource

app = create_app()

with app.app_context():
    owner_id = os.getenv("SEED_OWNER_ID", "").strip()
    if not owner_id:
        raise SystemExit("Set SEED_OWNER_ID to the intended Supabase Auth user UUID before seeding; unowned shared demo records are disabled.")
    if Subject.query.filter_by(owner_id=owner_id).count():
        print("Database already contains subjects; skipping seed.")
    else:
        ds = Subject(owner_id=owner_id, name="Data Structures", description="Build a strong foundation in core data structures.", accent_color="#7467F0", icon="network")
        dbms = Subject(owner_id=owner_id, name="Database Systems", description="Relational databases, SQL, normalization, and transactions.", accent_color="#E69A45", icon="database")
        web = Subject(owner_id=owner_id, name="Web Development", description="Frontend patterns, APIs, and practical projects.", accent_color="#2F9D83", icon="code-2")
        db.session.add_all([ds, dbms, web]); db.session.flush()
        linked = Topic(owner_id=owner_id, subject_id=ds.id, name="Linked Lists", description="Pointers, operations, and common interview problems.")
        trees = Topic(owner_id=owner_id, subject_id=ds.id, name="Trees & Graphs", description="Traversals, tree structures, and graph algorithms.")
        sql = Topic(owner_id=owner_id, subject_id=dbms.id, name="SQL Fundamentals", description="Queries, joins, aggregation, and subqueries.")
        react = Topic(owner_id=owner_id, subject_id=web.id, name="React Basics", description="Components, state, props, and effects.")
        db.session.add_all([linked, trees, sql, react]); db.session.flush()
        db.session.add_all([
            Resource(owner_id=owner_id, topic_id=linked.id, title="Linked Lists — Visual Introduction", description="A visual walkthrough of singly and doubly linked lists.", resource_type="video", url="https://www.youtube.com/", author="Learning playlist", tags=["beginner", "visual"], is_featured=True),
            Resource(owner_id=owner_id, topic_id=linked.id, title="Linked List Revision Notes", description="Concise notes covering insertion, deletion, traversal, and complexity.", resource_type="pdf", url="https://example.com/linked-list-notes.pdf", author="Course notes", tags=["revision", "exam" ]),
            Resource(owner_id=owner_id, topic_id=trees.id, title="Tree Traversals Cheat Sheet", description="A quick reference for preorder, inorder, and postorder traversals.", resource_type="article", url="https://example.com/tree-traversals", author="Study collection", tags=["cheat-sheet", "revision"], is_featured=True),
            Resource(owner_id=owner_id, topic_id=sql.id, title="SQL Joins Practice Set", description="Practice questions for INNER, LEFT, RIGHT, and FULL joins.", resource_type="question_paper", url="https://example.com/sql-joins", author="Practice set", tags=["practice", "sql"]),
            Resource(owner_id=owner_id, topic_id=react.id, title="React Official Documentation", description="Learn React fundamentals with interactive examples.", resource_type="article", url="https://react.dev/learn", author="React team", tags=["official", "beginner"], is_featured=True),
        ])
        db.session.commit()
        print("Seeded demo subjects, topics, and resources.")
