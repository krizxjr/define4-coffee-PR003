-- Open Attic Communities + Collections migration (PostgreSQL / Supabase).
-- Run after migrations/002_user_data_isolation.sql. Safe to re-run.
BEGIN;

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

COMMIT;
