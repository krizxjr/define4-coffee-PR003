<<<<<<< HEAD
# OpenAttic Flask API — Supabase Auth + per-user workspaces

Flask REST API for the OpenAttic learning-resource library. All API routes except `GET /api/health` require a valid Supabase Auth access token. The verified Supabase user ID is the owner ID used to isolate subjects, topics, resources, uploads, search results, deletes and signed file URLs.

## Setup

Requires Python 3.11+.

```bat
copy .env.example .env
```

Set `DATABASE_URL`, `FRONTEND_ORIGINS`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and (for file uploads) `SUPABASE_SERVICE_ROLE_KEY` in `.env`. The service-role key must never be exposed to the frontend.

Install and migrate:

```bat
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe migrate.py
.venv\Scripts\python.exe run.py
```

`start.bat` automates dependency installation, migration, and the server launch.

## Database migration

Run `migrate.py` against the same database specified by `DATABASE_URL` before using this version of the API. It adds `owner_id` fields, replaces globally unique subject names with per-owner uniqueness, creates owner indexes, and creates any missing Communities and Collections tables from the current model definitions. Existing unowned rows are hidden from signed-in users by default.

To assign all existing rows to one account, put `LEGACY_DATA_OWNER_ID=<Supabase Auth user UUID>` in backend `.env` before running the migration. Only do this if all old data should belong to that account. For multiple users, assign records explicitly instead. The PostgreSQL ownership migration is available in `migrations/002_user_data_isolation.sql`; `migrations/003_communities_collections.sql` can be run manually to provision the new community and collection tables.

## Environment variables

- `DATABASE_URL`: PostgreSQL connection string.
- `FRONTEND_ORIGINS`: comma-separated allowed frontend origins. Local static frontend uses port `4173` by default.
- `SUPABASE_URL`: project URL, used to verify access tokens and generate signed storage URLs.
- `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY`: public key used for token verification.
- `SUPABASE_SERVICE_ROLE_KEY`: backend-only privileged storage API key.
- `SUPABASE_STORAGE_BUCKET`: private storage bucket name, defaults to `learning-resources`.
- `AUTO_CREATE_TABLES`: defaults to `true` for local development. Existing production schemas still need `migrate.py`.
- `MAX_CONTENT_LENGTH_MB`: maximum upload size, defaults to 50 MB.
- `LEGACY_DATA_OWNER_ID`: optional one-time migration owner for all currently unassigned legacy rows.

## API routes

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Public API/database health check |
| GET | `/api/me` | Current verified user ID and email |
| GET | `/api/dashboard` | Per-user stats and recent/featured resources |
| GET/POST | `/api/subjects` | List/create the authenticated user's subjects |
| GET/PATCH/DELETE | `/api/subjects/:id` | Access only a subject owned by the caller |
| GET/POST | `/api/topics` | List/create the caller's topics |
| GET/PATCH/DELETE | `/api/topics/:id` | Access only topics owned by the caller |
| GET/POST | `/api/resources` | List/search/filter or create the caller's resources |
| GET/PATCH/DELETE | `/api/resources/:id` | Access only resources owned by the caller |
| GET | `/api/search?q=...` | Search the caller's resources only |
| POST | `/api/uploads/file` | Upload file to user-scoped storage path and create metadata |
| POST | `/api/uploads/pdf` | PDF-compatible upload endpoint |
| GET | `/api/resources/:id/file-url` | Generate signed URL only for a caller-owned file |
| GET/POST | `/api/communities` | Discover or create communities |
| GET | `/api/communities/:id/members` | Show community member names and roles without exposing account IDs/emails |
| POST/DELETE | `/api/communities/:id/join` | Join or leave a community |
| GET/POST | `/api/collections` | List or create the caller’s collections |
| GET/PATCH/DELETE | `/api/collections/:id` | Read, update, or delete the caller’s collection |
| POST | `/api/collections/:id/items` | Add a caller-owned resource to a collection |
| PATCH/DELETE | `/api/collections/:id/items/:item_id` | Toggle completion or remove an item within the collection |

Every protected request must send `Authorization: Bearer <Supabase access token>`. Ownership is derived from the verified token server-side; request-body owner IDs are ignored.

## File storage

Use a private Supabase Storage bucket. The API stores objects under a path such as `users/<auth-user-id>/topics/<topic-id>/<random>-filename`. It only returns short-lived signed URLs after checking that the resource and its parent subject/topic chain belong to the authenticated user.

## Security notes

- Data isolation is enforced in Flask queries and mutation checks. Don't add unscoped queries for user data.
- Keep `SUPABASE_SERVICE_ROLE_KEY` on the server only.
- Configure CORS for exact frontend origins and deploy over HTTPS.
- Unassigned legacy records are intentionally invisible until assigned to an owner.
=======
# LearnHub API — Flask + Supabase PostgreSQL

A hackathon-ready REST API for a student learning-resource hub. The API manages subjects, topics, resources, search, dashboard data, and uploads for PDFs, images, Office files, text/code files, audio/video, and archives to Supabase Storage.

## 1. Setup

Requires Python 3.11+.

```bash
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` from Supabase **Project Settings → Database**. Use a direct PostgreSQL connection string, or the session pooler if your network needs IPv4 compatibility. URL-encode special characters in the database password. Keep all secret keys out of the React app and Git.

For quick local development, leave `DATABASE_URL` unset and the API uses a local SQLite file. To use Supabase, set `DATABASE_URL` explicitly.

```bash
python run.py
```

API runs at `http://localhost:5000`; health check: `GET http://localhost:5000/api/health`.

## 2. Supabase PostgreSQL and Storage setup

1. Create a Supabase project.
2. In **Project Settings → Database**, copy a PostgreSQL connection string. Put it in backend `.env` as `DATABASE_URL`. Use the session pooler if your network cannot reach the direct database host. URL-encode special characters in the password.
3. In the Supabase **SQL Editor**, run the contents of `schema.sql`. It creates the tables and adds the new file metadata columns to an earlier LearnHub database.
4. In **Storage**, create a bucket named `learning-resources`. Prefer a **private** bucket; the API generates short-lived signed URLs for previews/downloads.
5. In backend `.env`, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`. Keep the service-role key on the Flask server only. Never put it in React/Vite variables or commit it to Git.
6. Set `AUTO_CREATE_TABLES=false` after applying `schema.sql` to Supabase. For local SQLite development, `AUTO_CREATE_TABLES=true` is convenient.

For an existing installation, run `python migrate.py` after configuring `DATABASE_URL`; this adds the file metadata columns without deleting existing records. The included `start.bat` runs this migration before starting the API. `create_all()` does not update existing tables, so use the migration or SQL script when upgrading.

### Supported uploads

`POST /api/uploads/file` accepts multipart form data with `file` and `topic_id`; optional fields are `title`, `description`, `author`, `tags` (comma-separated), `resource_type`, and `is_featured`. The backend detects a resource type from the file extension when one is not supplied. Common PDF, image, Word/OpenDocument, PowerPoint, spreadsheet, text/code, audio, video, and archive formats are accepted. The default upload limit is 50 MB; change `MAX_CONTENT_LENGTH_MB` in `.env` if needed.

Uploaded bytes go to Supabase Storage. PostgreSQL stores the filename, MIME type, size, bucket, storage path, and the associated topic/resource metadata. Files are not stored as binary blobs in PostgreSQL.

Use `GET /api/resources/<id>/file-url` to generate a short-lived signed URL for a private-bucket file. The URL expires after 300 seconds by default; `?expires_in=600` can request a different duration, capped at one hour. `POST /api/uploads/pdf` remains available as a compatibility endpoint for PDF-only clients.

Optional demo data:

```bash
python seed.py
```

## 3. Endpoints

All routes are under `/api` and return JSON.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | API/database health |
| GET | `/dashboard` | Stats, subjects, recent and featured resources |
| GET/POST | `/subjects` | List or create subjects |
| GET/PATCH/DELETE | `/subjects/:id` | Read, update, or delete subject |
| GET/POST | `/topics` | List topics (optional `?subject_id=1`) or create topic |
| GET/PATCH/DELETE | `/topics/:id` | Read, update, or delete topic |
| GET/POST | `/resources` | List/search/filter resources or create resource |
| GET/PATCH/DELETE | `/resources/:id` | Read, update, or delete resource |
| GET | `/search?q=trees` | Search resource title/description, topic, subject, and author |
| POST | `/uploads/file` | Upload supported file formats to Supabase Storage + create resource metadata |
| POST | `/uploads/pdf` | PDF-only compatibility endpoint |
| GET | `/resources/:id/file-url` | Create a short-lived signed URL for a stored file |

### Resource query parameters

`GET /api/resources?q=linked&subject_id=1&topic_id=2&type=video&tag=beginner&sort=newest&page=1&per_page=24`

Supported types: `pdf`, `image`, `document`, `presentation`, `spreadsheet`, `audio`, `video`, `archive`, `repository`, `question_paper`, `book`, `article`, `link`, `file`. `sort` supports `newest`, `oldest`, and `title`. Responses from the list endpoint use `{ "items": [], "pagination": { ... } }`.

### Create a subject

```json
POST /api/subjects
{
  "name": "Data Structures",
  "description": "Core data structures and algorithms",
  "accent_color": "#7467F0",
  "icon": "network"
}
```

### Create a topic

```json
POST /api/topics
{
  "subject_id": 1,
  "name": "Linked Lists",
  "description": "Operations and complexity"
}
```

### Create a resource

```json
POST /api/resources
{
  "topic_id": 1,
  "title": "Linked Lists — Visual Introduction",
  "description": "A visual explanation of common linked list operations.",
  "resource_type": "video",
  "url": "https://www.youtube.com/watch?v=example",
  "thumbnail_url": null,
  "author": "Course creator",
  "tags": ["beginner", "revision"],
  "is_featured": true
}
```


## 5. React connection

In your React `.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Minimal API client:

```js
const API = import.meta.env.VITE_API_BASE_URL;
export async function getDashboard() {
  const response = await fetch(`${API}/dashboard`);
  if (!response.ok) throw new Error('Could not load dashboard');
  return response.json();
}
export async function searchResources(query) {
  const response = await fetch(`${API}/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error('Search failed');
  return response.json();
}
```

## 6. Important MVP boundaries

- This starter has **no authentication or per-user authorization yet**. Treat it as a trusted demo API, not a public production service. Add Supabase Auth/JWT verification and authorization before public deployment.
- CORS is restricted to `FRONTEND_ORIGINS`; update this value for your deployed frontend.
- Uploaded file size is limited by `MAX_CONTENT_LENGTH_MB` (50 MB by default).
- Search uses PostgreSQL-compatible `ILIKE` matching for a fast MVP. It searches metadata, not the contents of uploaded PDFs or office documents.
- Subject/topic deletion cascades to their child records. The API returns a confirmation message but does not offer undo.
- `schema.sql` is a baseline schema; if you change models, update it or use migrations.
>>>>>>> c5470e1b1a8285e39a27e8041002e059bddd03e6
