# Open Attic

Open Attic is a central workspace for collecting and discovering learning resources such as PDFs, videos, GitHub repositories, websites, books, and past papers.

## Frontend setup

This frontend uses plain HTML, CSS, and JavaScript. A small Node.js development server reads environment variables from `.env`, generates `js/config.js`, and serves the app. No frontend framework or package installation is required.

### Requirements

- Node.js 18 or newer
- The Flask backend running separately if you want live API data

### 1. Create your local environment file

Windows Command Prompt:

```bat
copy .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Edit `.env` with the URLs and public client settings for your environment:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:5000/api
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
VITE_REQUIRE_AUTH=true
```

- `VITE_API_BASE_URL`: Flask API base URL, including `/api`. For a real per-user workspace, keep this set. Demo localStorage can be used only with `VITE_REQUIRE_AUTH=false`.
- `VITE_SUPABASE_URL`: your Supabase project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: your Supabase publishable key. `VITE_SUPABASE_ANON_KEY` is also accepted for older projects.
- `VITE_REQUIRE_AUTH`: keep `true` for per-user libraries. Set `false` only for demo mode; it does not disable backend authentication.

**Frontend environment values are delivered to the browser and are not secrets. Never put a Supabase service-role key, database password, or other private server credential in this file.** Protect data with Supabase Row Level Security and enforce authorization in the Flask API.

### 2. Start the frontend

```bash
npm run dev
```

Open `http://127.0.0.1:4173` in your browser. The login page is available at `http://127.0.0.1:4173/login.html`.

The server generates `js/config.js` from `.env` every time it starts. You can also regenerate the config without starting the server:

```bash
npm run config:generate
```

With `VITE_REQUIRE_AUTH=true`, missing environment configuration leads to a setup notice rather than demo mode. To intentionally explore the local demo, set `VITE_REQUIRE_AUTH=false` and clear `VITE_API_BASE_URL`. Do not open `index.html` directly with `file://` when testing authentication or API requests; serve it over HTTP.

## Add-resource flow and uploads

The Add Resource dialog is type-first: select Images, PDFs, Word, PPT, or Git Repos & Web Links before entering resource details. For file categories, choose **Provide a link** or **Upload a file**. The upload area accepts drag-and-drop as well as clicking to browse, and it checks that the chosen file extension matches the selected category. Git repositories and web links use URLs; the file upload path supports image files, PDFs, Word documents, and PowerPoint files. The Explore category thumbnails share one illustration style and consistent thumbnail frame.

## Optional Supabase Auth

1. Configure your Supabase project and enable Email authentication.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or legacy `VITE_SUPABASE_ANON_KEY`) in `.env`.
3. Add your local and deployed `login.html` redirect URLs to the Supabase Auth URL configuration.
4. Keep `VITE_REQUIRE_AUTH=true`. The Flask backend verifies every bearer token and scopes subjects, topics, resources, uploads, deletion, and signed file URLs to that Supabase user ID.
5. Configure Flask CORS to allow your frontend origin.

The frontend forwards a Supabase bearer token on API requests. The backend validates that token and derives ownership from the verified Supabase user ID; it never trusts a user ID sent in the request body. Local-only progress/bookmark metadata is namespaced by the signed-in user.

## Project structure

```text
index.html              Main library UI
login.html              Sign-in, account creation, and password reset
css/styles.css          Main styling
css/login.css           Authentication styling
js/config.js            Generated runtime config (do not edit manually)
js/auth.js              Supabase Auth adapter
js/login.js             Login form behavior
js/api.js               Backend API adapter and demo-mode storage
js/app.js               UI state, search, filters, cards, modals, theme
js/seed.js              Demo resources
scripts/generate-config.mjs  Reads .env and writes js/config.js
scripts/dev-server.mjs       Local Node.js static server
.env.example            Environment variable template
```

## Existing API routes

When `VITE_API_BASE_URL` points to the Flask backend, the adapter expects the backend routes for resources, subjects, topics, file upload, file URL creation, and deletion to match the request/response contracts in `js/api.js`. Check the Flask route definitions if a request fails; the frontend cannot correct API contract mismatches automatically.

## Per-user workspaces

Each authenticated user receives an isolated workspace. Flask validates the Supabase access token on each non-health API request, reads the user ID from Supabase Auth, and uses that verified ID as `owner_id` for subjects, topics, resources, dashboard counts, search, file upload, deletion, and signed file URLs. The browser never sends an owner ID to choose whose data to read or write.

Bookmarks/completion metadata stored locally is namespaced by the authenticated user ID. Actual resources and uploaded files are stored through the backend, not in browser localStorage.


## Communities and Collections

- **Communities** lets signed-in users discover communities, create a community, join or leave groups, and view member display names/roles. These use the authenticated Flask endpoints under `/api/communities`.
- **Collections** lets a user curate their own resources into named study paths. Completion is tracked per collection item and is available only within a collection; resource cards in the main library do not show a completed action. The authenticated Flask API persists collections and completion state in PostgreSQL.
- Uploads are limited by the interface and backend to Images, PDFs, Word documents, and PowerPoint presentations. Git repositories and other web links use the single **Git Repos & Web Links** category and are saved by URL.
- The login page's brand mark is no longer a link back to the library.

The updated migration script calls SQLAlchemy `create_all()` for the new `communities`, `community_memberships`, `collections`, and `collection_items` tables. For an existing Supabase/PostgreSQL database, back up first, configure backend `.env`, and run `python migrate.py` from `backend/learnhub_backend`.
