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
