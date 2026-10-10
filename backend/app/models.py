from datetime import datetime, timezone
from . import db


def utcnow():
    return datetime.now(timezone.utc)


class Subject(db.Model):
    __tablename__ = "subjects"
    id = db.Column(db.Integer, primary_key=True)
<<<<<<< HEAD
    # Supabase Auth user UUID. Nullable only so pre-migration records can be
    # migrated gradually; application-created records always set this value.
    owner_id = db.Column(db.String(36), nullable=True, index=True)
    name = db.Column(db.String(100), nullable=False, index=True)
=======
    name = db.Column(db.String(100), nullable=False, unique=True, index=True)
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
    description = db.Column(db.String(500), nullable=False, default="")
    accent_color = db.Column(db.String(20), nullable=False, default="#6D5EF5")
    icon = db.Column(db.String(50), nullable=False, default="book-open")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    topics = db.relationship("Topic", back_populates="subject", cascade="all, delete-orphan", order_by="Topic.name")
<<<<<<< HEAD
    __table_args__ = (db.UniqueConstraint("owner_id", "name", name="uq_subject_owner_name"),)

    def to_dict(self, include_topics=False):
        owned_topics = [t for t in self.topics if t.owner_id == self.owner_id]
        data = {
            "id": self.id, "name": self.name, "description": self.description,
            "accent_color": self.accent_color, "icon": self.icon,
            "topic_count": len(owned_topics),
            "resource_count": sum(sum(1 for r in t.resources if r.owner_id == self.owner_id) for t in owned_topics),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_topics:
            data["topics"] = [t.to_dict() for t in self.topics if t.owner_id == self.owner_id]
=======

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
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
        return data


class Topic(db.Model):
    __tablename__ = "topics"
    id = db.Column(db.Integer, primary_key=True)
<<<<<<< HEAD
    owner_id = db.Column(db.String(36), nullable=True, index=True)
=======
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
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
<<<<<<< HEAD
            "name": self.name, "description": self.description,
            "resource_count": sum(1 for r in self.resources if r.owner_id == self.owner_id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_resources:
            data["resources"] = [r.to_dict() for r in self.resources if r.owner_id == self.owner_id]
=======
            "name": self.name, "description": self.description, "resource_count": len(self.resources),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_resources:
            data["resources"] = [r.to_dict() for r in self.resources]
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
        return data


class Resource(db.Model):
    __tablename__ = "resources"
    id = db.Column(db.Integer, primary_key=True)
<<<<<<< HEAD
    owner_id = db.Column(db.String(36), nullable=True, index=True)
=======
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
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
<<<<<<< HEAD


class Community(db.Model):
    """A discoverable learning community owned by its creator and populated by members."""
    __tablename__ = "communities"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    description = db.Column(db.String(600), nullable=False, default="")
    created_by = db.Column(db.String(36), nullable=False, index=True)
    creator_name = db.Column(db.String(100), nullable=False, default="Open Attic member")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    memberships = db.relationship(
        "CommunityMembership", back_populates="community", cascade="all, delete-orphan",
        order_by="CommunityMembership.joined_at",
    )

    def to_dict(self, user_id=None):
        own_membership = next((m for m in self.memberships if user_id and m.user_id == str(user_id)), None)
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "creator_name": self.creator_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "member_count": len(self.memberships),
            "is_member": own_membership is not None,
            "my_role": own_membership.role if own_membership else None,
        }


class CommunityMembership(db.Model):
    """Membership record keyed by Supabase Auth UUID; display names are non-sensitive snapshots."""
    __tablename__ = "community_memberships"
    id = db.Column(db.Integer, primary_key=True)
    community_id = db.Column(db.Integer, db.ForeignKey("communities.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.String(36), nullable=False, index=True)
    display_name = db.Column(db.String(100), nullable=False, default="Open Attic member")
    role = db.Column(db.String(20), nullable=False, default="member")
    joined_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    community = db.relationship("Community", back_populates="memberships")
    __table_args__ = (db.UniqueConstraint("community_id", "user_id", name="uq_community_membership_user"),)

    def to_dict(self):
        return {
            "display_name": self.display_name,
            "role": self.role,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
        }


class LearningCollection(db.Model):
    """A user-owned study collection. Completion belongs to collection items, not resources."""
    __tablename__ = "collections"
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.String(36), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(600), nullable=False, default="")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    items = db.relationship(
        "LearningCollectionItem", back_populates="collection", cascade="all, delete-orphan",
        order_by="LearningCollectionItem.created_at.asc()",
    )
    __table_args__ = (db.UniqueConstraint("owner_id", "name", name="uq_collection_owner_name"),)

    def to_dict(self, include_items=False):
        items = list(self.items)
        data = {
            "id": self.id, "name": self.name, "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "item_count": len(items), "completed_count": sum(1 for item in items if item.is_completed),
        }
        if include_items:
            data["items"] = [item.to_dict() for item in items]
        return data


class LearningCollectionItem(db.Model):
    """A resource included in a collection; the only place completion is tracked."""
    __tablename__ = "collection_items"
    id = db.Column(db.Integer, primary_key=True)
    collection_id = db.Column(db.Integer, db.ForeignKey("collections.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_id = db.Column(db.Integer, db.ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    is_completed = db.Column(db.Boolean, nullable=False, default=False)
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    collection = db.relationship("LearningCollection", back_populates="items")
    resource = db.relationship("Resource")
    __table_args__ = (db.UniqueConstraint("collection_id", "resource_id", name="uq_collection_item_resource"),)

    def to_dict(self):
        resource_data = self.resource.to_dict() if self.resource else {}
        resource_data.update({
            "item_id": self.id, "resource_id": self.resource_id,
            "completed": bool(self.is_completed),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "added_at": self.created_at.isoformat() if self.created_at else None,
        })
        return resource_data
=======
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
