import os
import re
import mimetypes
import uuid
from datetime import datetime, timezone
<<<<<<< HEAD
from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy import or_, func
from werkzeug.utils import secure_filename
from urllib.request import Request as URLRequest, urlopen
from urllib.error import HTTPError, URLError
import json
from . import db
from .models import Subject, Topic, Resource, Community, CommunityMembership, LearningCollection, LearningCollectionItem
=======
from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import or_, func
from werkzeug.utils import secure_filename
from . import db
from .models import Subject, Topic, Resource
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6

api = Blueprint("api", __name__)
RESOURCE_TYPES = {"pdf", "image", "document", "presentation", "spreadsheet", "audio", "video", "archive", "repository", "question_paper", "book", "article", "link", "file"}


<<<<<<< HEAD
@api.before_request
def require_supabase_auth():
    """Verify Supabase access tokens for every API route except health/preflight."""
    if request.method == "OPTIONS" or request.endpoint == "api.health":
        return None
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return jsonify({"error": "Authentication required. Sign in and retry."}), 401

    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    publishable_key = (os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or "").strip()
    if not supabase_url or not publishable_key:
        current_app.logger.error("Supabase Auth is not configured: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).")
        return jsonify({"error": "Authentication is not configured on the backend."}), 503

    verify_request = URLRequest(
        f"{supabase_url}/auth/v1/user",
        headers={"apikey": publishable_key, "Authorization": f"Bearer {token.strip()}", "Accept": "application/json"},
        method="GET",
    )
    try:
        with urlopen(verify_request, timeout=8) as response:
            user = json.loads(response.read().decode("utf-8"))
        if not isinstance(user, dict) or not user.get("id"):
            return jsonify({"error": "Invalid or expired access token. Please sign in again."}), 401
        g.current_user = user
    except HTTPError as exc:
        if exc.code in (400, 401, 403):
            return jsonify({"error": "Invalid or expired access token. Please sign in again."}), 401
        current_app.logger.warning("Supabase Auth verification returned HTTP %s", exc.code)
        return jsonify({"error": "Authentication service temporarily unavailable."}), 503
    except (URLError, TimeoutError, ValueError, json.JSONDecodeError):
        current_app.logger.exception("Could not verify Supabase access token")
        return jsonify({"error": "Could not verify your session. Please try again."}), 503
    return None


=======
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
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


<<<<<<< HEAD
def current_owner_id():
    """Return the authenticated Supabase Auth user ID for this request."""
    user_id = getattr(g, "current_user", {}).get("id")
    if not user_id:
        # All non-health routes are auth-gated; this is defensive and fail-closed.
        raise RuntimeError("Authenticated request is missing a Supabase user ID")
    return str(user_id)


def get_owned_subject(subject_id):
    return Subject.query.filter_by(id=subject_id, owner_id=current_owner_id()).first()


def get_owned_topic(topic_id):
    owner = current_owner_id()
    return Topic.query.join(Subject).filter(
        Topic.id == topic_id,
        Topic.owner_id == owner,
        Subject.owner_id == owner,
    ).first()


def get_resource_or_404(resource_id):
    # Check ownership on the row and its parent chain, so cross-account IDs
    # behave like not-found even if old data was imported inconsistently.
    owner = current_owner_id()
    resource = Resource.query.join(Topic).join(Subject).filter(
        Resource.id == resource_id,
        Resource.owner_id == owner,
        Topic.owner_id == owner,
        Subject.owner_id == owner,
    ).first()
=======
def get_resource_or_404(resource_id):
    resource = db.session.get(Resource, resource_id)
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
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


<<<<<<< HEAD
@api.get("/me")
def me():
    """Return only the authenticated user's basic Supabase Auth profile."""
    user = getattr(g, "current_user", {})
    return jsonify({"id": current_owner_id(), "email": user.get("email")})


@api.get("/dashboard")
def dashboard():
    owner = current_owner_id()
    subjects = Subject.query.filter_by(owner_id=owner).order_by(Subject.name).all()
    owned_topics = Topic.query.join(Subject).filter(Topic.owner_id == owner, Subject.owner_id == owner)
    owned_resources = Resource.query.join(Topic).join(Subject).filter(
        Resource.owner_id == owner, Topic.owner_id == owner, Subject.owner_id == owner
    )
    recent = owned_resources.order_by(Resource.created_at.desc()).limit(8).all()
    featured = owned_resources.filter(Resource.is_featured.is_(True)).order_by(Resource.created_at.desc()).limit(6).all()
    counts = {
        "subjects": Subject.query.filter_by(owner_id=owner).count(),
        "topics": owned_topics.count(),
        "resources": owned_resources.count(),
        "pdfs": owned_resources.filter(Resource.resource_type == "pdf").count(),
        "videos": owned_resources.filter(Resource.resource_type == "video").count(),
=======
@api.get("/dashboard")
def dashboard():
    subjects = Subject.query.order_by(Subject.name).all()
    recent = Resource.query.order_by(Resource.created_at.desc()).limit(8).all()
    featured = Resource.query.filter_by(is_featured=True).order_by(Resource.created_at.desc()).limit(6).all()
    counts = {
        "subjects": Subject.query.count(), "topics": Topic.query.count(), "resources": Resource.query.count(),
        "pdfs": Resource.query.filter_by(resource_type="pdf").count(),
        "videos": Resource.query.filter_by(resource_type="video").count(),
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
    }
    return jsonify({"stats": counts, "subjects": [s.to_dict() for s in subjects], "recent_resources": [r.to_dict() for r in recent], "featured_resources": [r.to_dict() for r in featured]})


@api.get("/subjects")
def list_subjects():
<<<<<<< HEAD
    query = Subject.query.filter_by(owner_id=current_owner_id()).order_by(Subject.name)
    return jsonify([s.to_dict() for s in query.all()])
=======
    return jsonify([s.to_dict() for s in Subject.query.order_by(Subject.name).all()])
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6


@api.post("/subjects")
def create_subject():
    data, error = payload()
    if error: return error
    name, err = required_text(data, "name", 100)
    if err: return jsonify({"error": err}), 400
    description, err = required_text(data, "description", 500, required=False)
    if err: return jsonify({"error": err}), 400
<<<<<<< HEAD
    owner = current_owner_id()
    if Subject.query.filter(Subject.owner_id == owner, func.lower(Subject.name) == name.lower()).first():
        return jsonify({"error": "A subject with this name already exists"}), 409
    subject = Subject(owner_id=owner, name=name, description=description, accent_color=data.get("accent_color", "#6D5EF5"), icon=data.get("icon", "book-open"))
=======
    if Subject.query.filter(func.lower(Subject.name) == name.lower()).first():
        return jsonify({"error": "A subject with this name already exists"}), 409
    subject = Subject(name=name, description=description, accent_color=data.get("accent_color", "#6D5EF5"), icon=data.get("icon", "book-open"))
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
    db.session.add(subject); db.session.commit()
    return jsonify(subject.to_dict()), 201


@api.get("/subjects/<int:subject_id>")
def get_subject(subject_id):
<<<<<<< HEAD
    subject = get_owned_subject(subject_id)
=======
    subject = db.session.get(Subject, subject_id)
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
    if not subject: return jsonify({"error": "Subject not found"}), 404
    return jsonify(subject.to_dict(include_topics=True))


@api.patch("/subjects/<int:subject_id>")
def update_subject(subject_id):
<<<<<<< HEAD
    subject = get_owned_subject(subject_id)
=======
    subject = db.session.get(Subject, subject_id)
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
    if not subject: return jsonify({"error": "Subject not found"}), 404
    data, error = payload()
    if error: return error
    if "name" in data:
        name, err = required_text(data, "name", 100)
        if err: return jsonify({"error": err}), 400
<<<<<<< HEAD
        duplicate = Subject.query.filter(Subject.owner_id == current_owner_id(), func.lower(Subject.name) == name.lower(), Subject.id != subject_id).first()
=======
        duplicate = Subject.query.filter(func.lower(Subject.name) == name.lower(), Subject.id != subject_id).first()
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
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
<<<<<<< HEAD
    subject = get_owned_subject(subject_id)
    if not subject: return jsonify({"error": "Subject not found"}), 404
    owner = current_owner_id()
    if any(topic.owner_id != owner for topic in subject.topics) or any(
        resource.owner_id != owner for topic in subject.topics for resource in topic.resources
    ):
        return jsonify({"error": "Ownership records are inconsistent; repair the database before deleting this subject."}), 409
=======
    subject = db.session.get(Subject, subject_id)
    if not subject: return jsonify({"error": "Subject not found"}), 404
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
    stored_resources = [resource for topic in subject.topics for resource in topic.resources]
    storage_error = remove_storage_objects(stored_resources)
    if storage_error: return storage_error
    db.session.delete(subject); db.session.commit()
    return jsonify({"message": "Subject and its topics/resources deleted"})


@api.get("/topics")
def list_topics():
<<<<<<< HEAD
    owner = current_owner_id()
    query = Topic.query.join(Subject).filter(Topic.owner_id == owner, Subject.owner_id == owner)
    subject_id = request.args.get("subject_id", type=int)
    if subject_id: query = query.filter(Topic.subject_id == subject_id)
=======
    query = Topic.query
    subject_id = request.args.get("subject_id", type=int)
    if subject_id: query = query.filter_by(subject_id=subject_id)
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
    return jsonify([t.to_dict() for t in query.order_by(Topic.name).all()])


@api.post("/topics")
def create_topic():
    data, error = payload()
    if error: return error
    subject_id = data.get("subject_id")
<<<<<<< HEAD
    subject = get_owned_subject(subject_id) if isinstance(subject_id, int) else None
    if not subject:
        return jsonify({"error": "subject_id must refer to one of your subjects"}), 400
=======
    if not isinstance(subject_id, int) or not db.session.get(Subject, subject_id):
        return jsonify({"error": "subject_id must refer to an existing subject"}), 400
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
    name, err = required_text(data, "name", 120)
    if err: return jsonify({"error": err}), 400
    description, err = required_text(data, "description", 500, required=False)
    if err: return jsonify({"error": err}), 400
<<<<<<< HEAD
    if Topic.query.filter_by(owner_id=current_owner_id(), subject_id=subject_id, name=name).first():
        return jsonify({"error": "This topic already exists in the subject"}), 409
    topic = Topic(owner_id=current_owner_id(), subject_id=subject_id, name=name, description=description)
=======
    if Topic.query.filter_by(subject_id=subject_id, name=name).first():
        return jsonify({"error": "This topic already exists in the subject"}), 409
    topic = Topic(subject_id=subject_id, name=name, description=description)
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
    db.session.add(topic); db.session.commit()
    return jsonify(topic.to_dict()), 201


@api.get("/topics/<int:topic_id>")
def get_topic(topic_id):
<<<<<<< HEAD
    topic = get_owned_topic(topic_id)
=======
    topic = db.session.get(Topic, topic_id)
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
    if not topic: return jsonify({"error": "Topic not found"}), 404
    return jsonify(topic.to_dict(include_resources=True))


@api.patch("/topics/<int:topic_id>")
def update_topic(topic_id):
<<<<<<< HEAD
    topic = get_owned_topic(topic_id)
=======
    topic = db.session.get(Topic, topic_id)
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
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
<<<<<<< HEAD
    topic = get_owned_topic(topic_id)
    if not topic: return jsonify({"error": "Topic not found"}), 404
    owner = current_owner_id()
    if any(resource.owner_id != owner for resource in topic.resources):
        return jsonify({"error": "Ownership records are inconsistent; repair the database before deleting this topic."}), 409
    storage_error = remove_storage_objects(list(topic.resources))
=======
    topic = db.session.get(Topic, topic_id)
    if not topic: return jsonify({"error": "Topic not found"}), 404
    storage_error = remove_storage_objects(topic.resources)
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
    if storage_error: return storage_error
    db.session.delete(topic); db.session.commit()
    return jsonify({"message": "Topic and its resources deleted"})


def apply_resource_filters(query):
<<<<<<< HEAD
    # All resource list/search entry points pass through this owner filter.
    owner = current_owner_id()
    query = query.filter(
        Resource.owner_id == owner,
        Resource.topic.has(Topic.owner_id == owner),
        Resource.topic.has(Topic.subject.has(Subject.owner_id == owner)),
    )
    search = request.args.get("q", request.args.get("search", "")).strip()
=======
    search = request.args.get("search", "").strip()
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
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
<<<<<<< HEAD
    sort = request.args.get("sort", "newest")
    if sort == "title": query = query.order_by(Resource.title.asc())
    elif sort == "oldest": query = query.order_by(Resource.created_at.asc())
    else: query = query.order_by(Resource.created_at.desc())
=======
    sort = request.args.get("sort", "newest").strip().lower()
    if sort == "title": query = query.order_by(None).order_by(Resource.title.asc())
    elif sort == "oldest": query = query.order_by(None).order_by(Resource.created_at.asc())
    else: query = query.order_by(None).order_by(Resource.created_at.desc())
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 24, type=int), 1), 100)
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({"items": [r.to_dict() for r in pagination.items], "pagination": {"page": page, "per_page": per_page, "total": pagination.total, "pages": pagination.pages}})


@api.post("/resources")
def create_resource():
    data, error = payload()
    if error: return error
    topic_id = data.get("topic_id")
<<<<<<< HEAD
    topic = get_owned_topic(topic_id) if isinstance(topic_id, int) else None
    if not topic:
        return jsonify({"error": "topic_id must refer to one of your topics"}), 400
=======
    if not isinstance(topic_id, int) or not db.session.get(Topic, topic_id):
        return jsonify({"error": "topic_id must refer to an existing topic"}), 400
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
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
<<<<<<< HEAD
    resource = Resource(owner_id=current_owner_id(), topic_id=topic_id, title=title, description=description, resource_type=kind,
=======
    resource = Resource(topic_id=topic_id, title=title, description=description, resource_type=kind,
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
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
<<<<<<< HEAD
        new_topic = get_owned_topic(data["topic_id"]) if isinstance(data["topic_id"], int) else None
        if not new_topic:
            return jsonify({"error": "topic_id must refer to one of your topics"}), 400
=======
        if not isinstance(data["topic_id"], int) or not db.session.get(Topic, data["topic_id"]):
            return jsonify({"error": "topic_id must refer to an existing topic"}), 400
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
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
<<<<<<< HEAD
    ".pdf", ".doc", ".docx", ".ppt", ".pptx",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".tif", ".tiff", ".avif",
=======
    # Documents and notes
    ".pdf", ".txt", ".md", ".rtf", ".doc", ".docx", ".odt",
    # Presentations and spreadsheets
    ".ppt", ".pptx", ".odp", ".xls", ".xlsx", ".ods", ".csv",
    # Images
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".tif", ".tiff", ".avif",
    # Media and other study materials
    ".mp3", ".wav", ".m4a", ".ogg", ".mp4", ".webm", ".mov",
    ".zip", ".7z", ".rar", ".json", ".xml", ".html", ".css", ".js", ".py", ".java", ".c", ".cpp", ".sql",
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
}


def classify_upload(filename, mime_type):
    ext = os.path.splitext(filename.lower())[1]
    if ext == ".pdf": return "pdf"
    if ext in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".tif", ".tiff", ".avif"}: return "image"
<<<<<<< HEAD
    if ext in {".ppt", ".pptx"}: return "presentation"
    if ext in {".doc", ".docx"}: return "document"
=======
    if ext in {".ppt", ".pptx", ".odp"}: return "presentation"
    if ext in {".xls", ".xlsx", ".ods", ".csv"}: return "spreadsheet"
    if ext in {".mp3", ".wav", ".m4a", ".ogg"}: return "audio"
    if ext in {".mp4", ".webm", ".mov"}: return "video"
    if ext in {".zip", ".7z", ".rar"}: return "archive"
    if ext in {".txt", ".md", ".rtf", ".doc", ".docx", ".odt", ".json", ".xml", ".html", ".css", ".js", ".py", ".java", ".c", ".cpp", ".sql"}: return "document"
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
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
<<<<<<< HEAD
    topic = get_owned_topic(topic_id) if topic_id else None
    if not topic:
        return jsonify({"error": "topic_id must refer to one of your topics"}), 400
=======
    if not topic_id or not db.session.get(Topic, topic_id):
        return jsonify({"error": "topic_id must refer to an existing topic"}), 400
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6

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
<<<<<<< HEAD
    owner = current_owner_id()
    path = f"users/{owner}/topics/{topic_id}/{uuid.uuid4().hex}-{safe_name}"
=======
    path = f"topics/{topic_id}/{uuid.uuid4().hex}-{safe_name}"
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
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
<<<<<<< HEAD
            owner_id=owner, topic_id=topic_id, title=title, description=request.form.get("description", "")[:10000],
=======
            topic_id=topic_id, title=title, description=request.form.get("description", "")[:10000],
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
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
<<<<<<< HEAD


# ---------------------------------------------------------------------------
# Collections: per-user curated study paths. Completion is scoped to an item
# inside a collection; standalone library resources have no completion action.
# ---------------------------------------------------------------------------
def get_owned_collection(collection_id):
    return LearningCollection.query.filter_by(id=collection_id, owner_id=current_owner_id()).first()


@api.get("/collections")
def list_collections():
    owner = current_owner_id()
    collections = LearningCollection.query.filter_by(owner_id=owner).order_by(LearningCollection.created_at.desc()).all()
    return jsonify({"items": [item.to_dict() for item in collections], "total": len(collections)})


@api.post("/collections")
def create_collection():
    data, error = payload()
    if error: return error
    name, err = required_text(data, "name", 120)
    if err: return jsonify({"error": err}), 400
    description, err = required_text(data, "description", 600, required=False)
    if err: return jsonify({"error": err}), 400
    owner = current_owner_id()
    duplicate = LearningCollection.query.filter(
        LearningCollection.owner_id == owner, func.lower(LearningCollection.name) == name.lower()
    ).first()
    if duplicate: return jsonify({"error": "You already have a collection with this name"}), 409
    collection = LearningCollection(owner_id=owner, name=name, description=description)
    db.session.add(collection); db.session.commit()
    return jsonify(collection.to_dict()), 201


@api.get("/collections/<int:collection_id>")
def get_collection(collection_id):
    collection = get_owned_collection(collection_id)
    if not collection: return jsonify({"error": "Collection not found"}), 404
    return jsonify(collection.to_dict(include_items=True))


@api.patch("/collections/<int:collection_id>")
def update_collection(collection_id):
    collection = get_owned_collection(collection_id)
    if not collection: return jsonify({"error": "Collection not found"}), 404
    data, error = payload()
    if error: return error
    if "name" in data:
        name, err = required_text(data, "name", 120)
        if err: return jsonify({"error": err}), 400
        duplicate = LearningCollection.query.filter(
            LearningCollection.owner_id == current_owner_id(), func.lower(LearningCollection.name) == name.lower(),
            LearningCollection.id != collection_id,
        ).first()
        if duplicate: return jsonify({"error": "You already have a collection with this name"}), 409
        collection.name = name
    if "description" in data:
        description, err = required_text(data, "description", 600, required=False)
        if err: return jsonify({"error": err}), 400
        collection.description = description
    db.session.commit()
    return jsonify(collection.to_dict())


@api.delete("/collections/<int:collection_id>")
def delete_collection(collection_id):
    collection = get_owned_collection(collection_id)
    if not collection: return jsonify({"error": "Collection not found"}), 404
    db.session.delete(collection); db.session.commit()
    return jsonify({"message": "Collection deleted"})


@api.post("/collections/<int:collection_id>/items")
def add_collection_item(collection_id):
    collection = get_owned_collection(collection_id)
    if not collection: return jsonify({"error": "Collection not found"}), 404
    data, error = payload()
    if error: return error
    resource_id = data.get("resource_id")
    if not isinstance(resource_id, int): return jsonify({"error": "resource_id must be an integer"}), 400
    resource, error = get_resource_or_404(resource_id)
    if error: return error
    existing = LearningCollectionItem.query.filter_by(collection_id=collection_id, resource_id=resource_id).first()
    if existing: return jsonify({"error": "This resource is already in the collection"}), 409
    item = LearningCollectionItem(collection_id=collection_id, resource_id=resource.id)
    db.session.add(item); db.session.commit()
    return jsonify(item.to_dict()), 201


@api.patch("/collections/<int:collection_id>/items/<int:item_id>")
def update_collection_item(collection_id, item_id):
    collection = get_owned_collection(collection_id)
    if not collection: return jsonify({"error": "Collection not found"}), 404
    item = LearningCollectionItem.query.filter_by(id=item_id, collection_id=collection_id).first()
    if not item: return jsonify({"error": "Collection item not found"}), 404
    data, error = payload()
    if error: return error
    if "completed" not in data or not isinstance(data["completed"], bool):
        return jsonify({"error": "completed must be a boolean"}), 400
    item.is_completed = data["completed"]
    item.completed_at = datetime.now(timezone.utc) if item.is_completed else None
    db.session.commit()
    return jsonify(item.to_dict())


@api.delete("/collections/<int:collection_id>/items/<int:item_id>")
def remove_collection_item(collection_id, item_id):
    collection = get_owned_collection(collection_id)
    if not collection: return jsonify({"error": "Collection not found"}), 404
    item = LearningCollectionItem.query.filter_by(id=item_id, collection_id=collection_id).first()
    if not item: return jsonify({"error": "Collection item not found"}), 404
    db.session.delete(item); db.session.commit()
    return jsonify({"message": "Resource removed from collection"})


# ---------------------------------------------------------------------------
# Communities: discoverable groups of authenticated Open Attic users.
# All routes inherit the Supabase bearer-token verification above.
# ---------------------------------------------------------------------------
def current_display_name():
    user = getattr(g, "current_user", {}) or {}
    metadata = user.get("user_metadata") or {}
    name = metadata.get("full_name") or metadata.get("name") or metadata.get("display_name")
    if not name:
        email = user.get("email") or ""
        name = email.split("@", 1)[0] if email else "Open Attic member"
    name = str(name).strip()[:100]
    return name or "Open Attic member"


def get_community_or_404(community_id):
    community = Community.query.filter_by(id=community_id).first()
    if not community:
        return None, (jsonify({"error": "Community not found"}), 404)
    return community, None


@api.get("/communities")
def list_communities():
    """Return discoverable communities; each card indicates the current user's membership."""
    user_id = current_owner_id()
    search = request.args.get("search", "").strip()
    scope = request.args.get("scope", "all").strip().lower()
    query = Community.query
    if search:
        term = f"%{search}%"
        query = query.filter(or_(Community.name.ilike(term), Community.description.ilike(term)))
    communities = query.order_by(Community.created_at.desc()).limit(200).all()
    items = [community.to_dict(user_id) for community in communities]
    if scope == "mine":
        items = [item for item in items if item["is_member"]]
    return jsonify({"items": items, "total": len(items)})


@api.post("/communities")
def create_community():
    data, error = payload()
    if error:
        return error
    name, err = required_text(data, "name", 100)
    if err:
        return jsonify({"error": err}), 400
    description, err = required_text(data, "description", 600, required=False)
    if err:
        return jsonify({"error": err}), 400
    if Community.query.filter(func.lower(Community.name) == name.lower()).first():
        return jsonify({"error": "A community with this name already exists"}), 409

    user_id = current_owner_id()
    community = Community(
        name=name,
        description=description,
        created_by=user_id,
        creator_name=current_display_name(),
    )
    community.memberships.append(CommunityMembership(
        user_id=user_id,
        display_name=current_display_name(),
        role="admin",
    ))
    db.session.add(community)
    db.session.commit()
    return jsonify(community.to_dict(user_id)), 201


@api.get("/communities/<int:community_id>")
def get_community(community_id):
    community, error = get_community_or_404(community_id)
    if error:
        return error
    return jsonify(community.to_dict(current_owner_id()))


@api.post("/communities/<int:community_id>/join")
def join_community(community_id):
    community, error = get_community_or_404(community_id)
    if error:
        return error
    user_id = current_owner_id()
    existing = CommunityMembership.query.filter_by(community_id=community_id, user_id=user_id).first()
    if existing:
        return jsonify({"message": "You are already a member of this community", "community": community.to_dict(user_id)})
    membership = CommunityMembership(
        community_id=community_id,
        user_id=user_id,
        display_name=current_display_name(),
        role="member",
    )
    db.session.add(membership)
    db.session.commit()
    return jsonify({"message": "Joined community", "community": community.to_dict(user_id)}), 201


@api.delete("/communities/<int:community_id>/join")
def leave_community(community_id):
    community, error = get_community_or_404(community_id)
    if error:
        return error
    user_id = current_owner_id()
    membership = CommunityMembership.query.filter_by(community_id=community_id, user_id=user_id).first()
    if not membership:
        return jsonify({"error": "You are not a member of this community"}), 404

    other_members = CommunityMembership.query.filter(
        CommunityMembership.community_id == community_id,
        CommunityMembership.user_id != user_id,
    ).order_by(CommunityMembership.joined_at.asc()).all()
    if membership.role == "admin" and other_members and not any(m.role == "admin" for m in other_members):
        other_members[0].role = "admin"
    db.session.delete(membership)
    if not other_members and community.created_by == user_id:
        db.session.delete(community)
        db.session.commit()
        return jsonify({"message": "You left and the empty community was removed", "deleted": True})
    db.session.commit()
    return jsonify({"message": "Left community", "deleted": False})


@api.get("/communities/<int:community_id>/members")
def list_community_members(community_id):
    community, error = get_community_or_404(community_id)
    if error:
        return error
    members = CommunityMembership.query.filter_by(community_id=community_id).order_by(
        CommunityMembership.role.desc(), CommunityMembership.joined_at.asc()
    ).all()
    # Do not expose account email addresses or Supabase user UUIDs to other members.
    return jsonify({"community_id": community.id, "items": [member.to_dict() for member in members], "total": len(members)})
=======
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
