# LifeSynch AI — Personal Digital Life Management System

> **College Minor Project**  
> An AI-powered personal digital life management system that connects to authorized digital sources (Gmail and Google Calendar), identifies actionable information, understands its context, converts it into structured responsibilities, prioritizes important items, detects duplicates/changes, and presents everything in one organized, auto-updating dashboard.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | Node.js (v18+), TypeScript, Express.js, REST API |
| **Database** | PostgreSQL via Supabase (Relational storage with Row-Level Security) |
| **Data Synchronization** | Periodic REST API polling (10s intervals) & browser window-focus listeners |
| **Authentication** | Google OAuth 2.0 (Gmail & Calendar scopes) |
| **AI Extraction** | LLM API (Structured JSON Outputs validated with Zod schemas) |
| **Integrations** | Gmail API, Google Calendar API |
| **Browser Extension** | Chrome Manifest V3 (Companion overlay & popup assistant) |
| **Testing** | Vitest, Playwright, Postman, automated verification suites |

---

## 📂 Repository Structure

```text
lifesynch-ai/
├── package.json               # Root npm workspaces orchestrator
├── .gitignore                 # Standard ignores for node, build, and env files
├── README.md                  # Project documentation & run guides
│
├── shared/                    # Shared TypeScript domain contracts
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           # Root exports for shared types & schemas
│       ├── types/
│       │   ├── api.ts         # Standard ApiResponse envelope & HealthCheck types
│       │   ├── auth.ts        # User, AuthTokens, Google OAuth payload types
│       │   ├── task.ts        # Task, TaskPriority, TaskCategory, Create/Update DTOs
│       │   └── event.ts       # CalendarEvent, SyncProvider, SyncLog types
│       └── schemas/
│           └── task.ts        # Zod schemas for AI extraction & API request validation
│
├── backend/                   # Node.js + Express + TypeScript REST API
│   ├── .env.example           # Backend environment variable template
│   ├── .env                   # Local dev environment settings
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts          # Server bootstrap & graceful shutdown
│       ├── app.ts             # Express app setup, CORS, JSON parsing, routes
│       ├── config/
│       │   ├── env.ts         # Zod-validated environment config loader
│       │   └── supabase.ts    # Supabase PostgreSQL client factory
│       ├── controllers/       # HTTP Request Handlers
│       │   ├── health.controller.ts
│       │   ├── auth.controller.ts
│       │   ├── task.controller.ts
│       │   └── sync.controller.ts
│       ├── middlewares/       # Express middlewares
│       │   ├── error.middleware.ts     # Standardized error responses
│       │   ├── validate.middleware.ts  # Zod schema request validation
│       │   └── auth.middleware.ts      # Authentication guard
│       ├── routes/            # Express REST route definitions
│       │   ├── index.ts       # Aggregates under /api/v1
│       │   ├── health.routes.ts
│       │   ├── auth.routes.ts
│       │   ├── task.routes.ts
│       │   └── sync.routes.ts
│       ├── services/          # Business logic & integration boundaries
│       │   ├── task.service.ts         # Task CRUD (Supabase with in-memory fallback)
│       │   ├── ai/
│       │   │   └── extraction.service.ts # LLM structured output pipeline
│       │   └── google/
│       │       ├── oauth.service.ts    # Google OAuth 2.0 client
│       │       ├── gmail.service.ts    # Gmail API integration
│       │       └── calendar.service.ts # Google Calendar API integration
│       └── utils/
│           └── logger.ts      # Structured logger with levels and timestamps
│
└── frontend/                  # React + TypeScript + Vite + Tailwind CSS
    ├── .env.example           # Frontend environment variable template
    ├── .env                   # Local dev frontend environment
    ├── index.html             # HTML5 entrypoint with Google Inter font
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts         # Vite configuration with /api reverse proxy
    ├── tailwind.config.js     # Tailwind design system configuration
    ├── postcss.config.js
    └── src/
        ├── main.tsx           # React DOM root entrypoint
        ├── App.tsx            # Foundation dashboard & status monitor
        ├── index.css          # Tailwind base & glassmorphic styling
        ├── services/
        │   └── api.ts         # Type-safe API client wrapper
        └── components/
            ├── common/        # Button, Badge, Card, Navbar, Sidebar
            └── layout/        # AppLayout shell
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **npm**: v9.0.0 or later

### 2. Install All Dependencies
From the repository root, run:
```bash
npm install
```
*Because npm workspaces are configured, this single command installs dependencies across `root`, `shared`, `backend`, and `frontend` simultaneously.*

---

## 💻 Running the Application

### Option A: Run Full-Stack (Frontend + Backend) Simultaneously (Recommended)
```bash
npm run dev
```
This boots:
- **Backend API**: `http://localhost:5000`
- **Frontend Dashboard**: `http://localhost:5173`

### Option B: Run Services Individually
- **Backend Only**:
  ```bash
  npm run dev:backend
  ```
  *(or navigate to `cd backend` and run `npm run dev`)*

- **Frontend Only**:
  ```bash
  npm run dev:frontend
  ```
  *(or navigate to `cd frontend` and run `npm run dev`)*

---

## 🔐 Environment Variables

### Backend Configuration (`backend/.env`)
Copy `backend/.env.example` to `backend/.env`:
```bash
# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Auth & Security
JWT_SECRET=lifesynch-dev-secret-key-change-in-prod-12345

# Supabase PostgreSQL (Settings -> API in Supabase dashboard)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Google OAuth 2.0 (Google Cloud Console -> Credentials)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/v1/auth/google/callback

# AI Extraction Engine
LLM_PROVIDER=gemini
LLM_API_KEY=your-gemini-api-key
LLM_MODEL=gemini-1.5-flash

# Logging Level: debug | info | warn | error
LOG_LEVEL=debug
```

### Frontend Configuration (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:
```bash
# Leave blank during local development so requests use the Vite reverse proxy (/api)
VITE_API_URL=

# Supabase Public Keys (safe for browser)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> ⚠️ **Security Rule**: Never place Google OAuth Client Secrets or LLM API keys inside `frontend/.env`. All sensitive integrations and token exchanges must remain strictly on the backend.

---

## 📡 REST API Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | System health check (database, Google OAuth, LLM status) |
| `GET` | `/api/v1/auth/google` | Generates Google OAuth consent URL |
| `GET` | `/api/v1/auth/google/callback` | Exchanges authorization code for tokens |
| `GET` | `/api/v1/auth/me` | Fetches current user session profile |
| `GET` | `/api/v1/tasks` | Lists all responsibilities/tasks for user |
| `POST` | `/api/v1/tasks` | Creates a new task (Zod validated) |
| `GET` | `/api/v1/tasks/:id` | Retrieves single task by ID |
| `PATCH` | `/api/v1/tasks/:id` | Updates task status, priority, or fields |
| `DELETE` | `/api/v1/tasks/:id` | Deletes a task |
| `POST` | `/api/v1/sync/gmail` | Triggers email fetch & extraction pipeline |
| `POST` | `/api/v1/sync/calendar` | Triggers calendar events sync |
| `POST` | `/api/v1/sync/responsibilities` | Triggers AI responsibility generation |
| `GET` | `/api/v1/sync/status` | Returns latest sync logs and timestamps |
| `GET` | `/api/v1/reminders` | Retrieves active deadline reminders |
| `POST` | `/api/v1/assistant/ask` | Contextual conversational AI assistant |

---

## 🔄 Data Synchronization & Frontend Refresh Architecture

Rather than relying on persistent WebSockets or Supabase Realtime subscriptions, LifeSynch AI implements a reliable, lightweight polling and event-driven refresh model:

- **10-Second Periodic Polling**: The frontend continuously syncs with the Express backend via a 10-second `setInterval`, quietly triggering Google Calendar synchronization and refreshing active responsibilities, calendar events, emails, and deadline reminders.
- **Window-Focus Listeners**: Whenever the user returns to the LifeSynch browser tab (`window.addEventListener('focus', ...)`), the application immediately triggers calendar synchronization and updates the responsibilities list to reflect any external changes.
- **Dynamic Deadline Transitions**: A client-side 60-second timer continuously recalculates deadline urgencies and lifecycle statuses (e.g., dynamically moving items into *Needs Attention* or *Missed / Past* immediately when their deadline passes) without requiring manual refresh, full-page reloads, or UI flickering.
- **Idempotent Deduplication**: Synchronization pipelines run through strict semantic token matching and deduplication logic, ensuring background refreshes update existing obligations rather than creating duplicates.

---

## 📋 What Remains for Phase 1

1. **Google OAuth 2.0 Integration**:
   - Setting up real OAuth consent screen in Google Cloud Console.
   - Enabling Gmail API and Google Calendar API scopes.
   - Secure token storage and refresh handling in backend database.
2. **Supabase PostgreSQL Schema**:
   - Creating `users`, `tasks`, `calendar_events`, and `sync_logs` tables.
   - Setting up Row-Level Security (RLS) policies.
3. **Gmail & Calendar Data Sync Pipeline**:
   - Fetching real message threads, parsing headers and bodies.
   - Querying upcoming calendar events and meetings.
4. **AI Extraction Engine**:
   - Connecting LLM (Gemini 1.5 Flash) with structured JSON schemas.
   - Validating LLM output strictly with Zod schemas.
   - Deduplication and conflict detection.
