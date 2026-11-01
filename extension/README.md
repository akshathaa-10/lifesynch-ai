# LifeSynch AI — Chrome Extension & Overlay Assistant

The official LifeSynch AI browser companion. Provides quick browser access to your real obligations, deadlines, priority markers, and the conversational AI assistant without leaving your current webpage.

## Features

- **Open LifeSynch Instantly**: Click the toolbar icon or the on-page floating overlay badge to open your assistant.
- **Real Responsibilities**: Fetches live tasks from the authenticated user's account with priority badges (🔴 High, 🟠 Medium, 🟢 Low) and deadline information.
- **Conversational Assistant**: Chat directly with LifeSynch AI using existing backend capabilities (`POST /api/v1/assistant/ask`) with full contextual grounding.
- **Seamless Authentication**: Shares session with your LifeSynch web app (`http://localhost:5173`). If not signed in, a clear Google sign-in redirect is shown.
- **Strict Privacy & User Isolation**: Only accesses the authenticated user's data. Zero sensitive tokens (Google access/refresh tokens, API keys, service role keys) are ever exposed.

---

## How to Install in Chrome

1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select this folder: `e:\minproj\extension`.
6. Pin the **LifeSynch AI** extension to your toolbar.

---

## Architecture & Security

- **Backend API**: Connects to `http://localhost:5000/api/v1`.
- **CORS Protection**: Backed by secure origin checking in `backend/src/app.ts`.
- **Zero Mock Data**: Pulls actual user data from Supabase via `taskService` and `assistantService`.
