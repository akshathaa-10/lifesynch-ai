# LifeSynch AI — Project Report Documentation Materials

This directory contains the complete set of professional UML diagrams, Data Flow Diagrams (DFDs), and genuine application screenshots generated directly from the running **LifeSynch AI** project codebase.

All materials are formatted, dimensioned, and rendered at high resolution (Retina 2x / 300 DPI equivalent) specifically for seamless insertion into an **A4 academic minor project report** or technical documentation thesis.

---

## 📁 Directory Structure Overview

```text
report-materials/
├── README.md                                  # This documentation guide & caption catalog
├── diagram-01-overall-use-case.png            # High-Resolution UML Overall Use Case Diagram
├── diagram-02-detailed-use-case.png           # High-Resolution Detailed Use Case Diagram
├── diagram-03-system-architecture.png         # High-Resolution 4-Tier System Architecture Diagram
├── diagram-04-dfd-level-0.png                 # High-Resolution Context Diagram (DFD Level 0)
├── diagram-05-dfd-level-1.png                 # High-Resolution Functional DFD (DFD Level 1)
├── screenshot-01-login.png                    # Actual running Application: Login & OAuth Interface
├── screenshot-02-home-dashboard.png           # Actual running Application: Personal Intelligence Hub
├── screenshot-03-responsibilities.png         # Actual running Application: Responsibilities & Lifecycle
├── screenshot-04-responsibility-details.png   # Actual running Application: Responsibility Details Modal
├── screenshot-05-worth-knowing-details.png    # Actual running Application: Worth Knowing Intelligence Modal
├── screenshot-06-calendar.png                 # Actual running Application: Synced Calendar & Schedule
├── screenshot-07-ask-lifesynch-assistant.png  # Actual running Application: Ask LifeSynch AI Chatbot
├── screenshot-08-notifications.png            # Actual running Application: Notification & Deadline Alerts
└── sources/                                   # Fully editable source files for all diagrams
    ├── diagram-01-overall-use-case.mmd        # Mermaid source
    ├── diagram-01-overall-use-case.puml       # PlantUML source
    ├── diagram-01-overall-use-case.svg        # Scalable Vector Graphics
    ├── diagram-02-detailed-use-case.mmd
    ├── diagram-02-detailed-use-case.puml
    ├── diagram-02-detailed-use-case.svg
    ├── diagram-03-system-architecture.mmd
    ├── diagram-03-system-architecture.puml
    ├── diagram-03-system-architecture.svg
    ├── diagram-04-dfd-level-0.mmd
    ├── diagram-04-dfd-level-0.puml
    ├── diagram-04-dfd-level-0.svg
    ├── diagram-05-dfd-level-1.mmd
    ├── diagram-05-dfd-level-1.puml
    └── diagram-05-dfd-level-1.svg
```

---

## 📊 Part 1: UML & Data Flow Diagrams

### Figure 3.1: Overall Use Case Diagram
- **File Name**: `diagram-01-overall-use-case.png`
- **Resolution**: `2400 × 1700 px` (High-Resolution Raster)
- **Source Formats**: `sources/diagram-01-overall-use-case.svg`, `.puml`, `.mmd`
- **Suggested Report Caption**:  
  > **Figure 3.1: Overall Use Case Diagram of LifeSynch AI**, illustrating the primary human actor (Student/User), external service actors (Gmail API, Google Calendar API, and Gemini LLM Engine), and the primary implemented system use cases within the application boundary.
- **Academic Description**:  
  Demonstrates high-level system interactions. The User triggers authentication, views the unified dashboard, manages responsibilities, monitors calendar events, queries the conversational assistant, and searches connected data. External services are represented as secondary service actors invoked asynchronously by the backend during synchronization and AI extraction.

---

### Figure 3.2: Detailed Use Case Diagram
- **File Name**: `diagram-02-detailed-use-case.png`
- **Resolution**: `2700 × 1840 px` (High-Resolution Raster)
- **Source Formats**: `sources/diagram-02-detailed-use-case.svg`, `.puml`, `.mmd`
- **Suggested Report Caption**:  
  > **Figure 3.2: Detailed Use Case Diagram with Stereotyped Relationships**, detailing core sub-packages (*Data Ingestion & Auth*, *AI Extraction & Intelligence*, *Intelligence Hub & Tracking*, and *Conversational Assistant & Alerts*) along with explicit `<<include>>` and `<<extend>>` dependencies.
- **Academic Description**:  
  Provides decomposition of implemented functional requirements. Captures mandatory sub-routines (e.g., token verification, Zod schema validation, dynamic urgency recalculation, and semantic deduplication) using `<<include>>` stereotypes, and optional user-triggered interactions (e.g., detail modals, category filtering, and status changes) using `<<extend>>` stereotypes.

---

### Figure 3.3: 4-Tier System Architecture Diagram
- **File Name**: `diagram-03-system-architecture.png`
- **Resolution**: `2700 × 1920 px` (High-Resolution Raster)
- **Source Formats**: `sources/diagram-03-system-architecture.svg`, `.puml`, `.mmd`
- **Suggested Report Caption**:  
  > **Figure 3.3: 4-Tier System Architecture of LifeSynch AI**, depicting the Presentation Tier (React 18 SPA & Chrome Extension), API Gateway Tier (Express.js & Middlewares), Core Intelligence Tier (Domain Services & NLP Extraction Pipeline), and Data Storage Tier (PostgreSQL via Supabase & External Cloud APIs).
- **Academic Description**:  
  Maps the concrete technical stack and separation of concerns. Emphasizes end-to-end security via JWT authentication middleware, Zod request validation, autonomous 10-second polling coordination, multi-pass AI responsibility extraction with structured JSON schemas, and Row-Level Security (RLS) enforcement in Supabase PostgreSQL.

---

### Figure 3.4: Data Flow Diagram (DFD Level 0: Context Diagram)
- **File Name**: `diagram-04-dfd-level-0.png`
- **Resolution**: `2400 × 1700 px` (High-Resolution Raster)
- **Source Formats**: `sources/diagram-04-dfd-level-0.svg`, `.puml`, `.mmd`
- **Suggested Report Caption**:  
  > **Figure 3.4: Data Flow Diagram (DFD Level 0 — Context Diagram)**, showing the boundary of Process 0.0 (*LifeSynch AI System*), external entities (User, Google OAuth, Gmail Service, Google Calendar, and Gemini LLM), and all high-level incoming and outgoing data streams.
- **Academic Description**:  
  Establishes external interfacing contracts using Gane-Sarson / Yourdon notation. Depicts raw data entering the system from communication channels (emails, calendar entries) and authenticated user requests, with actionable intelligence, prioritized deadlines, and synthesized answers returned to the user.

---

### Figure 3.5: Data Flow Diagram (DFD Level 1)
- **File Name**: `diagram-05-dfd-level-1.png`
- **Resolution**: `2700 × 1920 px` (High-Resolution Raster)
- **Source Formats**: `sources/diagram-05-dfd-level-1.svg`, `.puml`, `.mmd`
- **Suggested Report Caption**:  
  > **Figure 3.5: Data Flow Diagram (DFD Level 1: Functional Decomposition)**, detailing the five primary sub-processes (1.0 Authentication, 2.0 Ingestion & Auto-Sync, 3.0 AI Responsibility Extraction, 4.0 Deadline Tracking & Alerts, 5.0 Conversational AI & Search) and persistent data stores (D1 through D5).
- **Academic Description**:  
  Traces internal state progression. Details how raw communications are staged into `D2: Ingested Sources`, transformed by Process 3.0 into structured obligations stored in `D3: Responsibilities`, evaluated by Process 4.0 against real-time deadline thresholds into `D4: Notifications`, and retrieved by Process 5.0 for grounded conversational response generation.

---

## 📸 Part 2: Actual Application Screenshots

All screenshots represent the actual running application booted from the local development server (`http://localhost:5173`) with live database data. Personal identities and email addresses have been securely anonymized to safeguard user privacy while preserving authentic interface behavior.

### Figure 4.1: User Authentication & Sign-in Interface
- **File Name**: `screenshot-01-login.png`
- **Dimensions**: `2880 × 1800 px` (1440 × 900 Viewport @ 2x DPI)
- **Suggested Report Caption**:  
  > **Figure 4.1: LifeSynch AI Authentication Interface**, showcasing the secure Google OAuth 2.0 entry point, brand typography, feature capabilities preview, and active backend operational status indicator.
- **Key Features Visible**:  
  - Google OAuth 2.0 Single Sign-On button.
  - Value proposition cards (Autonomous Extraction, Smart Categorization, Deadline Tracking).
  - Clean glassmorphism styling and responsive layout.

---

### Figure 4.2: Home Dashboard — Personal Intelligence Hub
- **File Name**: `screenshot-02-home-dashboard.png`
- **Dimensions**: `2880 × 1800 px` (1440 × 900 Viewport @ 2x DPI)
- **Suggested Report Caption**:  
  > **Figure 4.2: Personal Intelligence Hub (Main Dashboard)**, presenting the unified morning briefing, quick metric counters (Pending Actions, Due Today, Critical Deadlines, Synced Sources), life category distribution, and prioritized "Your Day" obligations.
- **Key Features Visible**:  
  - Real-time aggregation of multi-source information.
  - Life category breakdowns (Academic, Career, Finance, Personal).
  - Dynamic deadline badges with real-time urgency calculation.
  - Synchronized status indicators for Gmail and Google Calendar.

---

### Figure 4.3: Responsibilities Management & Lifecycle Tracking
- **File Name**: `screenshot-03-responsibilities.png`
- **Dimensions**: `2880 × 1800 px` (1440 × 900 Viewport @ 2x DPI)
- **Suggested Report Caption**:  
  > **Figure 4.3: Responsibilities Management View**, displaying segmented obligation buckets (*Needs Attention*, *Upcoming Commitments*, *Completed*), urgency status tags, derived actions, and digital source provenance badges.
- **Key Features Visible**:  
  - Prioritized table and cards with clear action summaries.
  - Derived specific next steps extracted directly from email bodies.
  - Source tracking (identifying originating email thread or calendar event).
  - Status management controls (Mark Done, In Progress, Change Category).

---

### Figure 4.4: Responsibility Detailed Inspection Modal
- **File Name**: `screenshot-04-responsibility-details.png`
- **Dimensions**: `2880 × 1800 px` (1440 × 900 Viewport @ 2x DPI)
- **Suggested Report Caption**:  
  > **Figure 4.4: Responsibility Details Modal Dialog**, highlighting AI-derived action items, recommended next steps, comprehensive description context, due dates, and direct links to source digital correspondence.
- **Key Features Visible**:  
  - Prominent "Action Required" callout container.
  - "Recommended Next Step" actionable guidance.
  - Sanitized body context preserving key academic/professional deadlines.
  - Metadata pill badges (Category, Urgency, Due Time).

---

### Figure 4.5: Worth Knowing Opportunities & Intelligence Modal
- **File Name**: `screenshot-05-worth-knowing-details.png`
- **Dimensions**: `2880 × 1800 px` (1440 × 900 Viewport @ 2x DPI)
- **Suggested Report Caption**:  
  > **Figure 4.5: "Worth Knowing" Non-Actionable Intelligence Modal**, demonstrating AI identification of career opportunities, hackathons, and announcements with extracted application windows and eligibility criteria.
- **Key Features Visible**:  
  - Opportunity discovery cards surfaced automatically without manual tagging.
  - Extraction of registration deadlines and reward/incentive structures.
  - Separation of informational opportunities from mandatory personal commitments.

---

### Figure 4.6: Google Calendar Synchronization & Agenda View
- **File Name**: `screenshot-06-calendar.png`
- **Dimensions**: `2880 × 1800 px` (1440 × 900 Viewport @ 2x DPI)
- **Suggested Report Caption**:  
  > **Figure 4.6: Synchronized Calendar & Schedule View**, displaying incoming events, academic reviews, viva evaluations, locations, and real-time meeting synchronization status.
- **Key Features Visible**:  
  - Chronological schedule breakdown with time badges.
  - Event location tags and confirmation status indicators.
  - Auto-refresh synchronization badge indicating active 10-second polling and focus listeners.

---

### Figure 4.7: Contextual Conversational Assistant ("Ask LifeSynch")
- **File Name**: `screenshot-07-ask-lifesynch-assistant.png`
- **Dimensions**: `2880 × 1800 px` (1440 × 900 Viewport @ 2x DPI)
- **Suggested Report Caption**:  
  > **Figure 4.7: "Ask LifeSynch" Conversational AI Assistant**, illustrating natural language query processing, contextual retrieval across emails, calendar, and tasks, and grounded response synthesis with attributed source citations.
- **Key Features Visible**:  
  - Conversational question prompt interface with quick suggested queries.
  - Grounded LLM response accurately referencing user-specific deadlines and priorities.
  - Built-in deterministic fallback ensuring prompt availability during external quota constraints.

---

### Figure 4.8: Proactive Notifications & Deadline Reminders
- **File Name**: `screenshot-08-notifications.png`
- **Dimensions**: `2880 × 1800 px` (1440 × 900 Viewport @ 2x DPI)
- **Suggested Report Caption**:  
  > **Figure 4.8: Notification & Proactive Reminder Panel**, showing active 24-hour and 48-hour deadline alerts, categorical filtering (*All*, *Deadlines*, *Calendar*, *Updates*), and unread badge counters.
- **Key Features Visible**:  
  - Real-time alert popover directly accessible from the navigation header.
  - Filter chips allowing rapid isolation of urgent academic/career deadlines.
  - Single-click "Mark as Read" and persistent synchronization with backend database.

---

## 🖨️ Guidelines for Inserting into Academic Report (A4 Format)

1. **Aspect Ratio and Scaling**:
   - All screenshots are captured at standard 16:10 desktop ratio (`1440 × 900` @ 2x, resulting in `2880 × 1800` pixels).
   - In Microsoft Word, LaTeX, or LibreOffice, insert images with a page width of **14 cm to 16 cm** (centered), which provides approximately 300 to 450 DPI print resolution without downsampling artifacts.
2. **LaTeX Snippet Example**:
   ```latex
   \\begin{figure}[htbp]
       \\centering
       \\includegraphics[width=0.88\\textwidth]{report-materials/diagram-03-system-architecture.png}
       \\caption{4-Tier System Architecture of LifeSynch AI}
       \\label{fig:system_architecture}
   \\end{figure}
   ```
3. **Editable Source Usage**:
   - If vector insertion is preferred (e.g. for PDF LaTeX compilation), the corresponding `.svg` files located in `report-materials/sources/` can be converted directly to `.pdf` using Inkscape or Cairo (`rsvg-convert -f pdf input.svg -o output.pdf`).
   - PlantUML (`.puml`) files can be customized using the PlantUML CLI or VS Code PlantUML extension.
   - Mermaid (`.mmd`) files can be directly embedded in GitHub Flavored Markdown documents or rendered via Mermaid CLI.

