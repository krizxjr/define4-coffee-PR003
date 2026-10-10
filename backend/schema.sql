-- Open Attic schema for PostgreSQL / Supabase.
-- For an existing deployment, also run migrations/002_user_data_isolation.sql.

CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  owner_id VARCHAR(36),
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  accent_color VARCHAR(20) NOT NULL DEFAULT '#6D5EF5',
  icon VARCHAR(50) NOT NULL DEFAULT 'book-open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_subject_owner_name UNIQUE (owner_id, name)
);

CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  owner_id VARCHAR(36),
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_topic_subject_name UNIQUE(subject_id, name)
);

CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  owner_id VARCHAR(36),
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  resource_type VARCHAR(30) NOT NULL DEFAULT 'link',
  url TEXT,
  storage_path TEXT,
  storage_bucket VARCHAR(120),
  file_name VARCHAR(255),
  mime_type VARCHAR(180),
  file_size BIGINT,
  thumbnail_url TEXT,
  author VARCHAR(180) NOT NULL DEFAULT '',
  year INTEGER,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Additive columns for existing installations.
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS owner_id VARCHAR(36);
ALTER TABLE topics ADD COLUMN IF NOT EXISTS owner_id VARCHAR(36);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS owner_id VARCHAR(36);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(120);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS mime_type VARCHAR(180);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS file_size BIGINT;

CREATE INDEX IF NOT EXISTS ix_subjects_owner_id ON subjects(owner_id);
CREATE INDEX IF NOT EXISTS ix_topics_owner_id ON topics(owner_id);
CREATE INDEX IF NOT EXISTS ix_resources_owner_id ON resources(owner_id);
CREATE INDEX IF NOT EXISTS ix_topics_subject_id ON topics(subject_id);
CREATE INDEX IF NOT EXISTS ix_resources_topic_id ON resources(topic_id);
CREATE INDEX IF NOT EXISTS ix_resources_resource_type ON resources(resource_type);
CREATE INDEX IF NOT EXISTS ix_resources_created_at ON resources(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_resources_title ON resources(title);
CREATE INDEX IF NOT EXISTS ix_resources_storage_path ON resources(storage_path);


-- Shared discoverable communities for authenticated users.
CREATE TABLE IF NOT EXISTS communities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(600) NOT NULL DEFAULT '',
  created_by VARCHAR(36) NOT NULL,
  creator_name VARCHAR(100) NOT NULL DEFAULT 'Open Attic member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_communities_name ON communities(name);
CREATE INDEX IF NOT EXISTS ix_communities_created_by ON communities(created_by);

CREATE TABLE IF NOT EXISTS community_memberships (
  id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL,
  display_name VARCHAR(100) NOT NULL DEFAULT 'Open Attic member',
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_community_membership_user UNIQUE (community_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_community_memberships_community_id ON community_memberships(community_id);
CREATE INDEX IF NOT EXISTS ix_community_memberships_user_id ON community_memberships(user_id);

-- User-owned collections. Completion state belongs to the collection item,
-- never to the general resource row.
CREATE TABLE IF NOT EXISTS collections (
  id SERIAL PRIMARY KEY,
  owner_id VARCHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(600) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_collection_owner_name UNIQUE (owner_id, name)
);
CREATE INDEX IF NOT EXISTS ix_collections_owner_id ON collections(owner_id);

CREATE TABLE IF NOT EXISTS collection_items (
  id SERIAL PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_collection_item_resource UNIQUE (collection_id, resource_id)
);
CREATE INDEX IF NOT EXISTS ix_collection_items_collection_id ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS ix_collection_items_resource_id ON collection_items(resource_id);
