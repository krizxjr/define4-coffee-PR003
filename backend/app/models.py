from datetime import datetime, timezone
from . import db


def utcnow():
    return datetime.now(timezone.utc)


class Subject(db.Model):
    __tablename__ = "subjects"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True, index=True)
    description = db.Column(db.String(500), nullable=False, default="")
    accent_color = db.Column(db.String(20), nullable=False, default="#6D5EF5")
    icon = db.Column(db.String(50), nullable=False, default="book-open")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    topics = db.relationship("Topic", back_populates="subject", cascade="all, delete-orphan", order_by="Topic.name")

    def to_dict(self, include_topics=False):
        data = {
            "id": self.id, "name": self.name, "description": self.description,
            "accent_color": self.accent_color, "icon": self.icon,
            "topic_count": len(self.topics),
            "resource_count": sum(len(t.resources) for t in self.topics),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_topics:
            data["topics"] = [t.to_dict() for t in self.topics]
        return data


class Topic(db.Model):
    __tablename__ = "topics"
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(500), nullable=False, default="")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    subject = db.relationship("Subject", back_populates="topics")
    resources = db.relationship("Resource", back_populates="topic", cascade="all, delete-orphan", order_by="Resource.created_at.desc()")
    __table_args__ = (db.UniqueConstraint("subject_id", "name", name="uq_topic_subject_name"),)

    def to_dict(self, include_resources=False):
        data = {
            "id": self.id, "subject_id": self.subject_id, "subject_name": self.subject.name if self.subject else None,
            "name": self.name, "description": self.description, "resource_count": len(self.resources),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_resources:
            data["resources"] = [r.to_dict() for r in self.resources]
        return data


class Resource(db.Model):
    __tablename__ = "resources"
    id = db.Column(db.Integer, primary_key=True)
    topic_id = db.Column(db.Integer, db.ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True)
    title = db.Column(db.String(240), nullable=False, index=True)
    description = db.Column(db.Text, nullable=False, default="")
    resource_type = db.Column(db.String(30), nullable=False, default="link", index=True)
    url = db.Column(db.Text, nullable=True)
    storage_path = db.Column(db.Text, nullable=True)
    storage_bucket = db.Column(db.String(120), nullable=True)
    file_name = db.Column(db.String(255), nullable=True)
    mime_type = db.Column(db.String(180), nullable=True)
    file_size = db.Column(db.BigInteger, nullable=True)
    thumbnail_url = db.Column(db.Text, nullable=True)
    author = db.Column(db.String(180), nullable=False, default="")
    year = db.Column(db.Integer, nullable=True)
    tags = db.Column(db.JSON, nullable=False, default=list)
    is_featured = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    topic = db.relationship("Topic", back_populates="resources")

    def to_dict(self):
        topic = self.topic
        subject = topic.subject if topic else None
        return {
            "id": self.id, "topic_id": self.topic_id, "topic_name": topic.name if topic else None,
            "subject_id": subject.id if subject else None, "subject_name": subject.name if subject else None,
            "title": self.title, "description": self.description, "resource_type": self.resource_type,
            "url": self.url, "storage_path": self.storage_path, "storage_bucket": self.storage_bucket,
            "file_name": self.file_name, "mime_type": self.mime_type, "file_size": self.file_size,
            "has_file": bool(self.storage_path), "thumbnail_url": self.thumbnail_url,
            "author": self.author, "year": self.year, "tags": self.tags or [], "is_featured": self.is_featured,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
