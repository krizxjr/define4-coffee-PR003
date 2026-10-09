import os
import re
import mimetypes
import uuid
from datetime import datetime, timezone
from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import or_, func
from werkzeug.utils import secure_filename
from . import db
from .models import Subject, Topic, Resource

api = Blueprint("api", __name__)
RESOURCE_TYPES = {"pdf", "image", "document", "presentation", "spreadsheet", "audio", "video", "archive", "repository", "question_paper", "book", "article", "link", "file"}


def payload():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None, (jsonify({"error": "Request body must be a JSON object"}), 400)
    return data, None


def required_text(data, key, max_length, required=True):
    value = data.get(key)
    if value is None:
        return (None, f"{key} is required") if required else ("", None)
    if not isinstance(value, str):
        return None, f"{key} must be a string"
    value = value.strip()
    if required and not value:
        return None, f"{key} is required"
    if len(value) > max_length:
        return None, f"{key} must be at most {max_length} characters"
    return value, None


def get_resource_or_404(resource_id):
    resource = db.session.get(Resource, resource_id)
    if not resource:
        return None, (jsonify({"error": "Resource not found"}), 404)
    return resource, None


@api.get("/health")
def health():
    try:
        db.session.execute(db.select(1))
        return jsonify({"status": "ok", "database": "connected", "timestamp": datetime.now(timezone.utc).isoformat()})
    except Exception:
        db.session.rollback()
        return jsonify({"status": "degraded", "database": "unavailable"}), 503


@api.get("/dashboard")
def dashboard():
    subjects = Subject.query.order_by(Subject.name).all()
    recent = Resource.query.order_by(Resource.created_at.desc()).limit(8).all()
    featured = Resource.query.filter_by(is_featured=True).order_by(Resource.created_at.desc()).limit(6).all()
    counts = {
        "subjects": Subject.query.count(), "topics": Topic.query.count(), "resources": Resource.query.count(),
        "pdfs": Resource.query.filter_by(resource_type="pdf").count(),
        "videos": Resource.query.filter_by(resource_type="video").count(),
    }
    return jsonify({"stats": counts, "subjects": [s.to_dict() for s in subjects], "recent_resources": [r.to_dict() for r in recent], "featured_resources": [r.to_dict() for r in featured]})


@api.get("/subjects")
def list_subjects():
    return jsonify([s.to_dict() for s in Subject.query.order_by(Subject.name).all()])


@api.post("/subjects")
def create_subject():
    data, error = payload()
    if error: return error
    name, err = required_text(data, "name", 100)
    if err: return jsonify({"error": err}), 400
    description, err = required_text(data, "description", 500, required=False)
    if err: return jsonify({"error": err}), 400
    if Subject.query.filter(func.lower(Subject.name) == name.lower()).first():
        return jsonify({"error": "A subject with this name already exists"}), 409
    subject = Subject(name=name, description=description, accent_color=data.get("accent_color", "#6D5EF5"), icon=data.get("icon", "book-open"))
    db.session.add(subject); db.session.commit()
    return jsonify(subject.to_dict()), 201


@api.get("/subjects/<int:subject_id>")
def get_subject(subject_id):
    subject = db.session.get(Subject, subject_id)
    if not subject: return jsonify({"error": "Subject not found"}), 404
    return jsonify(subject.to_dict(include_topics=True))


@api.patch("/subjects/<int:subject_id>")
def update_subject(subject_id):
    subject = db.session.get(Subject, subject_id)
    if not subject: return jsonify({"error": "Subject not found"}), 404
    data, error = payload()
    if error: return error
    if "name" in data:
        name, err = required_text(data, "name", 100)
        if err: return jsonify({"error": err}), 400
        duplicate = Subject.query.filter(func.lower(Subject.name) == name.lower(), Subject.id != subject_id).first()
        if duplicate: return jsonify({"error": "A subject with this name already exists"}), 409
        subject.name = name
    for field, limit in (("description", 500), ("accent_color", 20), ("icon", 50)):
        if field in data:
            value, err = required_text(data, field, limit, required=False)
            if err: return jsonify({"error": err}), 400
            setattr(subject, field, value)
    db.session.commit()
    return jsonify(subject.to_dict())


def remove_storage_objects(resources):
    """Delete uploaded objects before deleting their metadata; return an error response on failure."""
    stored = [r for r in resources if r.storage_path]
    if not stored:
        return None
    client, error = storage_client_or_error()
    if error:
        return error
    by_bucket = {}
    for resource in stored:
        bucket = resource.storage_bucket or os.getenv("SUPABASE_STORAGE_BUCKET", "learning-resources")
        by_bucket.setdefault(bucket, []).append(resource.storage_path)
    try:
        for bucket, paths in by_bucket.items():
            client.storage.from_(bucket).remove(paths)
    except Exception:
        current_app.logger.exception("Could not remove one or more files from Supabase Storage")
        return jsonify({"error": "Could not delete stored file(s); database records were not deleted."}), 502
    return None


@api.delete("/subjects/<int:subject_id>")
def delete_subject(subject_id):
    subject = db.session.get(Subject, subject_id)
    if not subject: return jsonify({"error": "Subject not found"}), 404
    stored_resources = [resource for topic in subject.topics for resource in topic.resources]
    storage_error = remove_storage_objects(stored_resources)
    if storage_error: return storage_error
    db.session.delete(subject); db.session.commit()
    return jsonify({"message": "Subject and its topics/resources deleted"})


@api.get("/topics")
def list_topics():
    query = Topic.query
    subject_id = request.args.get("subject_id", type=int)
    if subject_id: query = query.filter_by(subject_id=subject_id)
    return jsonify([t.to_dict() for t in query.order_by(Topic.name).all()])


@api.post("/topics")
def create_topic():
    data, error = payload()
    if error: return error
    subject_id = data.get("subject_id")
    if not isinstance(subject_id, int) or not db.session.get(Subject, subject_id):
        return jsonify({"error": "subject_id must refer to an existing subject"}), 400
    name, err = required_text(data, "name", 120)
    if err: return jsonify({"error": err}), 400
    description, err = required_text(data, "description", 500, required=False)
    if err: return jsonify({"error": err}), 400
    if Topic.query.filter_by(subject_id=subject_id, name=name).first():
        return jsonify({"error": "This topic already exists in the subject"}), 409
    topic = Topic(subject_id=subject_id, name=name, description=description)
    db.session.add(topic); db.session.commit()
    return jsonify(topic.to_dict()), 201


@api.get("/topics/<int:topic_id>")
def get_topic(topic_id):
    topic = db.session.get(Topic, topic_id)
    if not topic: return jsonify({"error": "Topic not found"}), 404
    return jsonify(topic.to_dict(include_resources=True))


@api.patch("/topics/<int:topic_id>")
def update_topic(topic_id):
    topic = db.session.get(Topic, topic_id)
    if not topic: return jsonify({"error": "Topic not found"}), 404
    data, error = payload()
    if error: return error
    if "name" in data:
        name, err = required_text(data, "name", 120)
        if err: return jsonify({"error": err}), 400
        topic.name = name
    if "description" in data:
        description, err = required_text(data, "description", 500, required=False)
        if err: return jsonify({"error": err}), 400
        topic.description = description
    db.session.commit()
    return jsonify(topic.to_dict())


@api.delete("/topics/<int:topic_id>")
def delete_topic(topic_id):
    topic = db.session.get(Topic, topic_id)
    if not topic: return jsonify({"error": "Topic not found"}), 404
    storage_error = remove_storage_objects(topic.resources)
    if storage_error: return storage_error
    db.session.delete(topic); db.session.commit()
    return jsonify({"message": "Topic and its resources deleted"})


def apply_resource_filters(query):
    search = request.args.get("search", "").strip()
    if search:
        term = f"%{search}%"
        query = query.join(Topic).join(Subject).filter(or_(Resource.title.ilike(term), Resource.description.ilike(term), Topic.name.ilike(term), Subject.name.ilike(term), Resource.author.ilike(term)))
    subject_id = request.args.get("subject_id", type=int)
    topic_id = request.args.get("topic_id", type=int)
    kind = request.args.get("type", "").strip().lower()
    if subject_id: query = query.filter(Resource.topic.has(Topic.subject_id == subject_id))
    if topic_id: query = query.filter(Resource.topic_id == topic_id)
    if kind:
        if kind not in RESOURCE_TYPES: return None, (jsonify({"error": "Invalid resource type", "allowed": sorted(RESOURCE_TYPES)}), 400)
        query = query.filter(Resource.resource_type == kind)
    tag = request.args.get("tag", "").strip()
    if tag:
        # JSON tag filtering is portable for our small MVP dataset.
        query = query.filter(Resource.tags.cast(db.String).ilike(f"%{tag}%"))
    return query, None


@api.get("/resources")
def list_resources():
    query, error = apply_resource_filters(Resource.query)
    if error: return error
    sort = request.args.get("sort", "newest").strip().lower()
    if sort == "title": query = query.order_by(None).order_by(Resource.title.asc())
    elif sort == "oldest": query = query.order_by(None).order_by(Resource.created_at.asc())
    else: query = query.order_by(None).order_by(Resource.created_at.desc())
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 24, type=int), 1), 100)
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({"items": [r.to_dict() for r in pagination.items], "pagination": {"page": page, "per_page": per_page, "total": pagination.total, "pages": pagination.pages}})


@api.post("/resources")
def create_resource():
    data, error = payload()
    if error: return error
    topic_id = data.get("topic_id")
    if not isinstance(topic_id, int) or not db.session.get(Topic, topic_id):
        return jsonify({"error": "topic_id must refer to an existing topic"}), 400
    title, err = required_text(data, "title", 240)
    if err: return jsonify({"error": err}), 400
    description, err = required_text(data, "description", 10000, required=False)
    if err: return jsonify({"error": err}), 400
    kind = data.get("resource_type", "link")
    if kind not in RESOURCE_TYPES: return jsonify({"error": "Invalid resource_type", "allowed": sorted(RESOURCE_TYPES)}), 400
    url = data.get("url")
    if url is not None and (not isinstance(url, str) or (url and not re.match(r"^https?://", url, re.I))):
        return jsonify({"error": "url must start with http:// or https://"}), 400
    tags = data.get("tags", [])
    if not isinstance(tags, list) or any(not isinstance(t, str) for t in tags):
        return jsonify({"error": "tags must be an array of strings"}), 400
    resource = Resource(topic_id=topic_id, title=title, description=description, resource_type=kind,
        url=url, thumbnail_url=data.get("thumbnail_url"), author=data.get("author", ""), year=data.get("year"),
        tags=[t.strip() for t in tags if t.strip()][:20], is_featured=bool(data.get("is_featured", False)))
    db.session.add(resource); db.session.commit()
    return jsonify(resource.to_dict()), 201


@api.get("/resources/<int:resource_id>")
def get_resource(resource_id):
    resource, error = get_resource_or_404(resource_id)
    if error: return error
    return jsonify(resource.to_dict())


@api.patch("/resources/<int:resource_id>")
def update_resource(resource_id):
    resource, error = get_resource_or_404(resource_id)
    if error: return error
    data, error = payload()
    if error: return error
    if "topic_id" in data:
        if not isinstance(data["topic_id"], int) or not db.session.get(Topic, data["topic_id"]):
            return jsonify({"error": "topic_id must refer to an existing topic"}), 400
        resource.topic_id = data["topic_id"]
    for field, limit in (("title", 240), ("description", 10000), ("author", 180), ("thumbnail_url", 2000)):
        if field in data:
            value, err = required_text(data, field, limit, required=(field == "title"))
            if err: return jsonify({"error": err}), 400
            setattr(resource, field, value)
    if "resource_type" in data:
        if data["resource_type"] not in RESOURCE_TYPES: return jsonify({"error": "Invalid resource_type", "allowed": sorted(RESOURCE_TYPES)}), 400
        resource.resource_type = data["resource_type"]
    if "url" in data:
        url = data["url"]
        if url and (not isinstance(url, str) or not re.match(r"^https?://", url, re.I)):
            return jsonify({"error": "url must start with http:// or https://"}), 400
        resource.url = url
    if "tags" in data:
        if not isinstance(data["tags"], list) or any(not isinstance(t, str) for t in data["tags"]): return jsonify({"error": "tags must be an array of strings"}), 400
        resource.tags = [t.strip() for t in data["tags"] if t.strip()][:20]
    if "year" in data: resource.year = data["year"]
    if "is_featured" in data: resource.is_featured = bool(data["is_featured"])
    db.session.commit()
    return jsonify(resource.to_dict())


@api.delete("/resources/<int:resource_id>")
def delete_resource(resource_id):
    resource, error = get_resource_or_404(resource_id)
    if error: return error
    storage_error = remove_storage_objects([resource])
    if storage_error: return storage_error
    db.session.delete(resource); db.session.commit()
    return jsonify({"message": "Resource deleted"})


@api.get("/search")
def search():
    query_text = request.args.get("q", "").strip()
    if not query_text:
        return jsonify({"query": "", "items": [], "total": 0})
    query, error = apply_resource_filters(Resource.query)
    if error: return error
    items = query.order_by(Resource.is_featured.desc(), Resource.created_at.desc()).limit(50).all()
    return jsonify({"query": query_text, "items": [r.to_dict() for r in items], "total": len(items)})


ALLOWED_UPLOAD_EXTENSIONS = {
    # Documents and notes
    ".pdf", ".txt", ".md", ".rtf", ".doc", ".docx", ".odt",
    # Presentations and spreadsheets
    ".ppt", ".pptx", ".odp", ".xls", ".xlsx", ".ods", ".csv",
    # Images
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".tif", ".tiff", ".avif",
    # Media and other study materials
    ".mp3", ".wav", ".m4a", ".ogg", ".mp4", ".webm", ".mov",
    ".zip", ".7z", ".rar", ".json", ".xml", ".html", ".css", ".js", ".py", ".java", ".c", ".cpp", ".sql",
}


def classify_upload(filename, mime_type):
    ext = os.path.splitext(filename.lower())[1]
    if ext == ".pdf": return "pdf"
    if ext in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".tif", ".tiff", ".avif"}: return "image"
    if ext in {".ppt", ".pptx", ".odp"}: return "presentation"
    if ext in {".xls", ".xlsx", ".ods", ".csv"}: return "spreadsheet"
    if ext in {".mp3", ".wav", ".m4a", ".ogg"}: return "audio"
    if ext in {".mp4", ".webm", ".mov"}: return "video"
    if ext in {".zip", ".7z", ".rar"}: return "archive"
    if ext in {".txt", ".md", ".rtf", ".doc", ".docx", ".odt", ".json", ".xml", ".html", ".css", ".js", ".py", ".java", ".c", ".cpp", ".sql"}: return "document"
    return "file"


def storage_client_or_error():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key or "YOUR_PROJECT_REF" in url or "YOUR_SERVICE_ROLE_KEY" in key:
        return None, (jsonify({"error": "File storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the backend .env file."}), 503)
    from supabase import create_client
    return create_client(url, key), None


@api.post("/uploads/file")
def upload_file():
    """Upload a learning file to Supabase Storage and create its resource metadata row."""
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "Choose a file using the 'file' field"}), 400
    safe_name = secure_filename(file.filename)
    if not safe_name:
        return jsonify({"error": "The filename is invalid"}), 400
    extension = os.path.splitext(safe_name.lower())[1]
    if extension not in ALLOWED_UPLOAD_EXTENSIONS:
        return jsonify({"error": "This file extension is not supported", "allowed_extensions": sorted(ALLOWED_UPLOAD_EXTENSIONS)}), 415

    topic_id = request.form.get("topic_id", type=int)
    if not topic_id or not db.session.get(Topic, topic_id):
        return jsonify({"error": "topic_id must refer to an existing topic"}), 400

    content = file.read()
    if not content:
        return jsonify({"error": "The uploaded file is empty"}), 400
    max_bytes = current_app.config["MAX_CONTENT_LENGTH"]
    if len(content) > max_bytes:
        return jsonify({"error": "File is too large", "max_mb": max_bytes // (1024 * 1024)}), 413

    client, error = storage_client_or_error()
    if error:
        return error
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "learning-resources")
    mime_type = file.mimetype or mimetypes.guess_type(safe_name)[0] or "application/octet-stream"
    path = f"topics/{topic_id}/{uuid.uuid4().hex}-{safe_name}"
    try:
        client.storage.from_(bucket).upload(path, content, {"content-type": mime_type, "upsert": "false"})
        title = request.form.get("title", "").strip() or os.path.splitext(safe_name)[0]
        if len(title) > 240:
            title = title[:240]
        requested_type = request.form.get("resource_type", "").strip().lower()
        inferred_type = classify_upload(safe_name, mime_type)
        resource_type = requested_type if requested_type in RESOURCE_TYPES else inferred_type
        raw_tags = request.form.get("tags", "").strip()
        tags = [tag.strip() for tag in raw_tags.split(",") if tag.strip()][:20]
        resource = Resource(
            topic_id=topic_id, title=title, description=request.form.get("description", "")[:10000],
            resource_type=resource_type, url=None, storage_path=path, storage_bucket=bucket,
            file_name=safe_name, mime_type=mime_type, file_size=len(content),
            author=request.form.get("author", "")[:180], tags=tags,
            is_featured=request.form.get("is_featured", "false").lower() in {"true", "1", "yes"},
        )
        db.session.add(resource)
        db.session.commit()
        return jsonify(resource.to_dict()), 201
    except Exception:
        db.session.rollback()
        current_app.logger.exception("File upload failed")
        # Best-effort cleanup if storage succeeded but metadata creation failed.
        try:
            client.storage.from_(bucket).remove([path])
        except Exception:
            current_app.logger.warning("Could not clean up orphaned storage object %s", path)
        return jsonify({"error": "File upload failed. Verify the Storage bucket exists and backend credentials are correct."}), 502


@api.post("/uploads/pdf")
def upload_pdf_compat():
    """Backward-compatible PDF upload endpoint; uses the generic upload implementation."""
    file = request.files.get("file")
    if not file or not file.filename or not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Choose a PDF file using the 'file' field"}), 400
    # Reuse the same handler while preserving this route for existing clients.
    return upload_file()


@api.get("/resources/<int:resource_id>/file-url")
def resource_file_url(resource_id):
    """Return a short-lived signed URL for an object in a private Supabase Storage bucket."""
    resource, error = get_resource_or_404(resource_id)
    if error:
        return error
    if not resource.storage_path:
        return jsonify({"error": "This resource does not have an uploaded file"}), 404
    client, error = storage_client_or_error()
    if error:
        return error
    bucket = resource.storage_bucket or os.getenv("SUPABASE_STORAGE_BUCKET", "learning-resources")
    try:
        expires_in = min(max(request.args.get("expires_in", 300, type=int), 60), 3600)
        result = client.storage.from_(bucket).create_signed_url(resource.storage_path, expires_in)
        signed_url = result.get("signedURL") or result.get("signedUrl") or result.get("signed_url")
        if signed_url and signed_url.startswith("/"):
            signed_url = os.getenv("SUPABASE_URL", "").rstrip("/") + signed_url
        if not signed_url:
            current_app.logger.error("Supabase Storage returned no signed URL for resource %s", resource_id)
            return jsonify({"error": "Could not create a file access URL"}), 502
        return jsonify({"url": signed_url, "expires_in": expires_in, "resource_id": resource.id})
    except Exception:
        current_app.logger.exception("Could not create signed file URL")
        return jsonify({"error": "Could not create a file access URL. Check the Storage bucket and permissions."}), 502
