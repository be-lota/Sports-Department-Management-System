# Sports Department Equipment & Facility Booking System

A full-stack web app for managing university sports facility bookings and equipment loans.
Students book facilities and borrow equipment; sports officers approve/reject loan requests and
check equipment in/out; admins manage users, roles, and view analytics/reports.

Front end is plain HTML/CSS/JS (no build step). Backend is Node/Express with a SQLite database
that ships **as a file inside the repo** — clone it, install dependencies, and it runs with real
seeded data. No separate database server to install or configure.

## Features

- **Auth** — register, login, role-based dashboards (student / sports officer / admin), JWT sessions
- **Facility booking (calendar)** — browse facilities, book a date/time slot, automatic
  double-booking prevention, cancel your own bookings
- **Equipment tracking & check-in/check-out** — browse equipment with live stock status
  (in stock / low stock / out of stock), request a loan, officer approves/rejects, officer marks
  returned (check-in) which restores stock
- **Notifications** — booking/loan status updates, unread badge, mark read / mark all read
- **Complaints** — students report issues, officers/admins resolve them
- **Admin tools** — user management, role assignment, analytics charts (Chart.js), report
  generation and export to CSV / Excel / PDF
- **Officer tools** — facility time-slot management, equipment inventory quantity edits

## Tech stack

| Layer | Choice |
|---|---|
| Front end | Static HTML/CSS/vanilla JS (no framework, no bundler) |
| Backend | Node.js + Express |
| Database | SQLite via Node's built-in `node:sqlite` module (no native compilation needed) |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` password hashing |
| Reports | `pdfkit` (PDF) and `exceljs` (Excel) — both pure JS, no native build step |
| Charts | Chart.js (loaded via CDN on the admin dashboard) |

Everything above is pure JavaScript — there is no native/compiled dependency anywhere in this
project, so `npm install` works on a bare machine with no Visual Studio Build Tools, Python, or
other native toolchain.

## Requirements

- **Node.js 22.5 or newer** (needed for the built-in `node:sqlite` module). Check with:
  ```bash
  node -v
  ```

## Project structure

```
project/
  index.html             Landing page (entry point)
  pages/                  Every other page (login/register/dashboards/etc.)
  assets/
    css/style.css
    js/
      api.js              Shared ApiClient + AppState, loaded first on every page
      auth.js             Login/register/logout/route-guard
      student.js           Student dashboard/facilities/equipment/profile
      officer.js           Officer dashboard/bookings/loans/inventory/reports
      admin.js             Admin dashboard/users/roles/analytics/reports
      script.js            Landing-page-only helpers (contact form)
    images/
backend/
  data/sports.db         SQLite database file — committed to the repo
  src/
    server.js            Express app entry point
    db.js                 DB connection + migration runner
    seed.js               Demo data seeder
    migrations/*.sql
    middleware/auth.js    JWT auth + role-guard middleware
    routes/*.routes.js    One file per API resource
    lib/notify.js         Shared notification-insert helper
  .env.example
  package.json
docs/                    Local planning notes (gitignored, not part of the repo history)
```

## Running it locally

### Quick start (Windows)

From the repo root, right-click `run.ps1` → **Run with PowerShell** (or run it from a terminal):

```powershell
.\run.ps1
```

This installs backend dependencies on first run, creates `backend/.env` if missing, starts the
backend and front end each in their own terminal window, and opens the site in your browser.
Close those two windows to stop the servers.

### Manual setup (any OS)

#### 1. Start the backend

```bash
cd backend
npm install
cp .env.example .env    # on Windows PowerShell: Copy-Item .env.example .env
npm start
```

This runs on `http://localhost:8000`. On first boot it automatically applies any pending
database migrations. The repo already ships with `backend/data/sports.db` pre-seeded — you don't
need to run anything else to get demo data. If you ever want to reset to a clean demo state:

```bash
rm backend/data/sports.db backend/data/sports.db-shm backend/data/sports.db-wal
npm run seed
```

#### 2. Serve the front end

The front end is static files, so any static file server works. From the **repo root**:

```bash
npx serve -l 5500 .
```

Then open `http://localhost:5500/project/index.html` in a browser. (Opening `index.html` directly
via `file://` will not work — the browser blocks the API requests. It needs to be served over HTTP.)

`project/assets/js/api.js` already points at `http://localhost:8000/api` by default, so as long as
the backend is running on port 8000, everything just works.

#### 3. Log in

Demo accounts (all use password `password123`):

| Role | Email |
|---|---|
| Admin | `admin@sports.edu` |
| Sports Officer | `officer@sports.edu` |
| Student | `student@sports.edu` |
| Student | `jane.wanjiru@student.sports.edu` |
| Student | `brian.kiptoo@student.sports.edu` |
| Student | `amina.yusuf@student.sports.edu` |

You can also register a new student account from the landing page.

## Backend scripts

Run from inside `backend/`:

| Command | What it does |
|---|---|
| `npm start` | Start the server on port 8000 |
| `npm run dev` | Start with `node --watch` (auto-restarts on file changes) |
| `npm run migrate` | Apply any pending SQL migrations without starting the server |
| `npm run seed` | Apply migrations, then insert demo data (skips if users already exist) |

## Environment variables

`backend/.env` (copy from `.env.example`):

```
PORT=8000
JWT_SECRET=change-this-to-a-long-random-string
```

`JWT_SECRET` should be changed to a real random value before this is ever exposed beyond your own
machine — the committed `.env.example` value is a placeholder, not a secret.

## API overview

Base URL: `http://localhost:8000/api`. Every response is shaped `{ success, data, message }`.
Authenticated routes require `Authorization: Bearer <token>` (the token comes back from
`POST /auth/login`).

| Resource | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/verify`, `POST /auth/logout` |
| Facilities | `GET/POST /facilities`, `GET/PUT/DELETE /facilities/:id` |
| Time slots | `GET/POST /time-slots`, `DELETE /time-slots/:id` |
| Bookings | `GET/POST /bookings`, `GET/PUT /bookings/:id`, `POST /bookings/:id/cancel` |
| Equipment | `GET/POST /equipment`, `GET/PUT /equipment/:id` |
| Loans | `GET/POST /loans`, `POST /loans/:id/approve`, `POST /loans/:id/reject`, `POST /loans/:id/return` |
| Users | `GET /users/me`, `GET /users`, `GET/PUT /users/:id`, `PUT /users/:id/role`, `POST /users/change-password` |
| Notifications | `GET /notifications`, `POST /notifications` (admin broadcast), `POST /notifications/:id/read`, `POST /notifications/read-all` |
| Analytics | `GET /analytics` |
| Reports | `POST /reports/generate`, `GET /reports/export?type=&format=csv\|xlsx\|pdf` |
| Complaints | `GET/POST /complaints`, `PUT /complaints/:id` |

## Known limitations

This was built as a demo/coursework project, not a production system:

- No rate limiting, no HTTPS, minimal input validation beyond required-field checks
- `JWT_SECRET` ships with a placeholder value in `.env.example` — must be changed for any real
  deployment
- Profile picture upload isn't wired to a real upload endpoint
- Facility Management (time slots) and Equipment Inventory editing exist on the officer
  dashboard, but there's no bulk/CSV import for initial data — it's all seeded via `seed.js`
- Admin "Manage Users" has no suspend/delete (no backend endpoint for either) — role changes go
  through the Assign Roles page instead
- Admin Settings (system info, booking rules, notification preferences, backup/restore, log out
  all devices) has no backend to persist any of it and is intentionally inert in the UI — only
  Change Password on that page is real
