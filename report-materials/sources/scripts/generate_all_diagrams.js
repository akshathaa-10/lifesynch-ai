const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const REPORT_DIR = 'E:\\minproj\\report-materials';
const SOURCES_DIR = path.join(REPORT_DIR, 'sources');

if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
if (!fs.existsSync(SOURCES_DIR)) fs.mkdirSync(SOURCES_DIR, { recursive: true });

// ============================================================================
// 1. OVERALL USE CASE DIAGRAM
// ============================================================================

const overallUseCasePUML = `@startuml diagram-01-overall-use-case
skinparam packageStyle rectangle
skinparam shadowing false
skinparam defaultFontName "Segoe UI, Arial, sans-serif"
skinparam defaultFontSize 12
skinparam roundCorner 10

skinparam actor {
    BackgroundColor #E0F2FE
    BorderColor #0284C7
    FontColor #0F172A
}

skinparam usecase {
    BackgroundColor #F8FAFC
    BorderColor #0284C7
    FontColor #0F172A
}

skinparam rectangle {
    BackgroundColor #FFFFFF
    BorderColor #94A3B8
    FontColor #0F172A
}

actor "User\\n(Student / Individual)" as User
actor "Gmail API" as Gmail <<External System>>
actor "Google Calendar API" as Calendar <<External System>>
actor "Gemini LLM Engine" as LLM <<External System>>

rectangle "LifeSynch AI System Boundary" {
    usecase "UC1: Authenticate via Google OAuth 2.0" as UC1
    usecase "UC2: Ingest & Synchronize Digital Sources" as UC2
    usecase "UC3: Extract & Classify Responsibilities" as UC3
    usecase "UC4: Surface 'Worth Knowing' Opportunities" as UC4
    usecase "UC5: View Personal Intelligence Hub" as UC5
    usecase "UC6: Track & Manage Responsibilities" as UC6
    usecase "UC7: Synchronize & View Calendar Schedule" as UC7
    usecase "UC8: Query Conversational Assistant" as UC8
    usecase "UC9: Receive Proactive Reminders & Alerts" as UC9
    usecase "UC10: Perform Unified Cross-Source Search" as UC10
}

User --> UC1
User --> UC5
User --> UC6
User --> UC7
User --> UC8
User --> UC9
User --> UC10

UC1 --> Gmail
UC1 --> Calendar
UC2 --> Gmail
UC2 --> Calendar
UC3 --> LLM
UC4 --> LLM
UC8 --> LLM

@enduml
`;

const overallUseCaseMMD = `flowchart LR
    subgraph Users ["User Actor"]
        U["fa:fa-user User<br/>(Student / Individual)"]
    end

    subgraph System ["LifeSynch AI System Boundary"]
        UC1(["UC1: Authenticate via Google OAuth 2.0"])
        UC2(["UC2: Ingest & Synchronize Digital Sources"])
        UC3(["UC3: Extract & Classify Responsibilities"])
        UC4(["UC4: Surface 'Worth Knowing' Opportunities"])
        UC5(["UC5: View Personal Intelligence Hub"])
        UC6(["UC6: Track & Manage Responsibilities"])
        UC7(["UC7: Synchronize & View Calendar Schedule"])
        UC8(["UC8: Query Conversational Assistant"])
        UC9(["UC9: Receive Proactive Reminders & Alerts"])
        UC10(["UC10: Perform Unified Cross-Source Search"])
    end

    subgraph External ["External Services"]
        GM["fa:fa-envelope Gmail API"]
        GC["fa:fa-calendar Google Calendar API"]
        AI["fa:fa-brain Gemini LLM Engine"]
    end

    U --> UC1
    U --> UC5
    U --> UC6
    U --> UC7
    U --> UC8
    U --> UC9
    U --> UC10

    UC1 --> GM
    UC1 --> GC
    UC2 --> GM
    UC2 --> GC
    UC3 --> AI
    UC4 --> AI
    UC8 --> AI

    style Users fill:#e0f2fe,stroke:#0284c7,stroke-width:2px
    style System fill:#ffffff,stroke:#64748b,stroke-width:2px
    style External fill:#f1f5f9,stroke:#475569,stroke-width:2px
`;

const overallUseCaseSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 850" width="1200" height="850">
  <defs>
    <style>
      .bg { fill: #ffffff; }
      .title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 20px; font-weight: bold; fill: #0f172a; text-anchor: middle; }
      .subtitle { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; fill: #64748b; text-anchor: middle; }
      .boundary { fill: #fcfdfd; stroke: #94a3b8; stroke-width: 2; stroke-dasharray: 6,4; rx: 16; }
      .boundary-lbl { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: bold; fill: #334155; }
      .actor-card { fill: #f0f9ff; stroke: #0284c7; stroke-width: 2; rx: 12; }
      .actor-ext { fill: #f8fafc; stroke: #475569; stroke-width: 2; rx: 12; }
      .actor-title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; font-weight: bold; fill: #0f172a; text-anchor: middle; }
      .actor-sub { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; fill: #475569; text-anchor: middle; }
      .uc-box { fill: #ffffff; stroke: #0284c7; stroke-width: 1.5; rx: 22; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.04)); }
      .uc-text { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12.5px; font-weight: 600; fill: #0f172a; text-anchor: middle; }
      .uc-id { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: bold; fill: #0369a1; text-anchor: middle; }
      .line { stroke: #64748b; stroke-width: 1.6; fill: none; }
      .line-accent { stroke: #0284c7; stroke-width: 1.8; fill: none; }
      .arrow { fill: #64748b; }
      .arrow-accent { fill: #0284c7; }
    </style>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M 0 0 L 8 4 L 0 8 Z" class="arrow" />
    </marker>
    <marker id="arr-acc" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M 0 0 L 8 4 L 0 8 Z" class="arrow-accent" />
    </marker>
  </defs>

  <rect width="100%" height="100%" class="bg" />

  <!-- Diagram Header -->
  <text x="600" y="42" class="title">LifeSynch AI — Overall Use Case Diagram</text>
  <text x="600" y="65" class="subtitle">System Boundary, Primary Human Actors, High-Level Use Cases, and External Integration Boundaries</text>

  <!-- Left: Primary Actor (User) -->
  <g transform="translate(60, 360)">
    <rect x="-55" y="-55" width="110" height="135" class="actor-card" />
    <!-- Human Stick Figure Icon -->
    <circle cx="0" cy="-20" r="14" fill="#0284c7" />
    <path d="M 0 -6 L 0 28 M -22 6 L 22 6 M 0 28 L -14 55 M 0 28 L 14 55" stroke="#0284c7" stroke-width="3" stroke-linecap="round" fill="none" />
    <text x="0" y="66" class="actor-title">User</text>
    <text x="0" y="79" class="actor-sub">(Student / Individual)</text>
  </g>

  <!-- System Boundary -->
  <rect x="230" y="100" width="670" height="710" class="boundary" />
  <text x="250" y="128" class="boundary-lbl">SYSTEM BOUNDARY: LifeSynch AI Platform</text>

  <!-- Use Cases inside boundary (2 columns) -->
  <!-- Column 1 -->
  <!-- UC1 -->
  <g transform="translate(390, 180)">
    <rect x="-140" y="-24" width="280" height="48" class="uc-box" />
    <text x="0" y="-4" class="uc-id">UC-01</text>
    <text x="0" y="14" class="uc-text">Authenticate via Google OAuth 2.0</text>
  </g>

  <!-- UC2 -->
  <g transform="translate(390, 250)">
    <rect x="-140" y="-24" width="280" height="48" class="uc-box" />
    <text x="0" y="-4" class="uc-id">UC-02</text>
    <text x="0" y="14" class="uc-text">Ingest &amp; Synchronize Digital Sources</text>
  </g>

  <!-- UC3 -->
  <g transform="translate(390, 320)">
    <rect x="-140" y="-24" width="280" height="48" class="uc-box" />
    <text x="0" y="-4" class="uc-id">UC-03</text>
    <text x="0" y="14" class="uc-text">Extract &amp; Classify Responsibilities</text>
  </g>

  <!-- UC4 -->
  <g transform="translate(390, 390)">
    <rect x="-140" y="-24" width="280" height="48" class="uc-box" />
    <text x="0" y="-4" class="uc-id">UC-04</text>
    <text x="0" y="14" class="uc-text">Surface "Worth Knowing" Insights</text>
  </g>

  <!-- UC5 -->
  <g transform="translate(390, 460)">
    <rect x="-140" y="-24" width="280" height="48" class="uc-box" />
    <text x="0" y="-4" class="uc-id">UC-05</text>
    <text x="0" y="14" class="uc-text">View Personal Intelligence Hub</text>
  </g>

  <!-- UC6 -->
  <g transform="translate(390, 530)">
    <rect x="-140" y="-24" width="280" height="48" class="uc-box" />
    <text x="0" y="-4" class="uc-id">UC-06</text>
    <text x="0" y="14" class="uc-text">Track &amp; Manage Responsibilities</text>
  </g>

  <!-- Column 2 -->
  <!-- UC7 -->
  <g transform="translate(730, 250)">
    <rect x="-140" y="-24" width="280" height="48" class="uc-box" />
    <text x="0" y="-4" class="uc-id">UC-07</text>
    <text x="0" y="14" class="uc-text">Synchronize &amp; View Calendar Schedule</text>
  </g>

  <!-- UC8 -->
  <g transform="translate(730, 390)">
    <rect x="-140" y="-24" width="280" height="48" class="uc-box" />
    <text x="0" y="-4" class="uc-id">UC-08</text>
    <text x="0" y="14" class="uc-text">Query Conversational Assistant</text>
  </g>

  <!-- UC9 -->
  <g transform="translate(730, 530)">
    <rect x="-140" y="-24" width="280" height="48" class="uc-box" />
    <text x="0" y="-4" class="uc-id">UC-09</text>
    <text x="0" y="14" class="uc-text">Receive Proactive Deadline Reminders</text>
  </g>

  <!-- UC10 -->
  <g transform="translate(560, 660)">
    <rect x="-150" y="-24" width="300" height="48" class="uc-box" />
    <text x="0" y="-4" class="uc-id">UC-10</text>
    <text x="0" y="14" class="uc-text">Perform Unified Cross-Source Search</text>
  </g>

  <!-- Right: External Actors -->
  <!-- Gmail API -->
  <g transform="translate(1080, 200)">
    <rect x="-70" y="-40" width="140" height="80" class="actor-ext" />
    <rect x="-18" y="-30" width="36" height="26" rx="4" fill="#ea4335" />
    <path d="M -16 -28 L 0 -16 L 16 -28" stroke="#ffffff" stroke-width="2" fill="none" />
    <text x="0" y="16" class="actor-title">Gmail API</text>
    <text x="0" y="30" class="actor-sub">&lt;&lt;Service Actor&gt;&gt;</text>
  </g>

  <!-- Google Calendar API -->
  <g transform="translate(1080, 360)">
    <rect x="-70" y="-40" width="140" height="80" class="actor-ext" />
    <rect x="-18" y="-30" width="36" height="26" rx="4" fill="#4285f4" />
    <text x="0" y="-12" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle">31</text>
    <text x="0" y="16" class="actor-title">Google Calendar</text>
    <text x="0" y="30" class="actor-sub">&lt;&lt;Service Actor&gt;&gt;</text>
  </g>

  <!-- Gemini LLM Engine -->
  <g transform="translate(1080, 520)">
    <rect x="-70" y="-40" width="140" height="80" class="actor-ext" />
    <circle cx="0" cy="-18" r="14" fill="#9333ea" />
    <path d="M -7 -18 L 7 -18 M 0 -25 L 0 -11" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />
    <text x="0" y="16" class="actor-title">Gemini LLM</text>
    <text x="0" y="30" class="actor-sub">&lt;&lt;AI Engine Actor&gt;&gt;</text>
  </g>

  <!-- Association Lines from User -->
  <!-- User to UC1 -->
  <path d="M 115 360 C 180 340, 200 200, 250 180" class="line-accent" />
  <!-- User to UC5 -->
  <path d="M 115 380 C 180 400, 200 450, 250 460" class="line-accent" />
  <!-- User to UC6 -->
  <path d="M 115 400 C 170 430, 200 510, 250 530" class="line-accent" />
  <!-- User to UC7 -->
  <path d="M 115 370 C 220 320, 480 270, 590 250" class="line-accent" />
  <!-- User to UC8 -->
  <path d="M 115 390 C 220 400, 480 395, 590 390" class="line-accent" />
  <!-- User to UC9 -->
  <path d="M 115 410 C 200 470, 480 520, 590 530" class="line-accent" />
  <!-- User to UC10 -->
  <path d="M 115 420 C 180 520, 300 640, 410 660" class="line-accent" />

  <!-- Association Lines from Use Cases to External Actors -->
  <!-- UC1 to Gmail -->
  <path d="M 530 180 C 700 160, 900 180, 1010 195" class="line" marker-end="url(#arr)" />
  <!-- UC1 to Calendar -->
  <path d="M 530 190 C 700 220, 920 320, 1010 345" class="line" marker-end="url(#arr)" />
  <!-- UC2 to Gmail -->
  <path d="M 530 250 C 720 230, 920 220, 1010 210" class="line" marker-end="url(#arr)" />
  <!-- UC2 to Calendar -->
  <path d="M 530 260 C 720 290, 920 340, 1010 355" class="line" marker-end="url(#arr)" />
  <!-- UC3 to LLM -->
  <path d="M 530 320 C 720 360, 900 480, 1010 510" class="line" marker-end="url(#arr)" />
  <!-- UC4 to LLM -->
  <path d="M 530 390 C 720 420, 900 495, 1010 520" class="line" marker-end="url(#arr)" />
  <!-- UC8 to LLM -->
  <path d="M 870 390 C 940 410, 970 470, 1010 520" class="line" marker-end="url(#arr)" />

</svg>
`;

// ============================================================================
// 2. DETAILED USE CASE DIAGRAM
// ============================================================================

const detailedUseCasePUML = `@startuml diagram-02-detailed-use-case
skinparam packageStyle rectangle
skinparam shadowing false
skinparam defaultFontName "Segoe UI, Arial, sans-serif"
skinparam defaultFontSize 11
skinparam roundCorner 8

skinparam actor {
    BackgroundColor #E0F2FE
    BorderColor #0284C7
    FontColor #0F172A
}

skinparam usecase {
    BackgroundColor #FFFFFF
    BorderColor #0284C7
    FontColor #0F172A
}

actor "User" as User
actor "Gmail Service" as Gmail <<External>>
actor "Google Calendar" as Calendar <<External>>
actor "Gemini LLM" as LLM <<AI Engine>>

rectangle "LifeSynch AI — Detailed Use Cases" {
    package "Data Ingestion & Auth" {
        usecase "Ingest Digital Sources" as UC_Ingest
        usecase "Verify OAuth 2.0 Session" as UC_Auth
        usecase "Sync Gmail Messages" as UC_SyncGmail
        usecase "Sync Calendar Events" as UC_SyncCal
    }

    package "AI Extraction & Intelligence" {
        usecase "Extract Responsibilities" as UC_Extract
        usecase "Filter Non-Actionable Content" as UC_Filter
        usecase "Validate Schema via Zod" as UC_Zod
        usecase "Deduplicate & Reconcile Records" as UC_Dedup
        usecase "Surface Worth Knowing Items" as UC_WorthKnowing
        usecase "View Opportunity Modal" as UC_OppModal
    }

    package "Intelligence Hub & Lifecycle Tracking" {
        usecase "View Personal Intelligence Hub" as UC_Hub
        usecase "Calculate Dynamic Urgency" as UC_Urgency
        usecase "Filter by Life Category" as UC_CatFilter
        usecase "Manage Responsibilities" as UC_Manage
        usecase "View Responsibility Modal" as UC_RespModal
        usecase "Update Status & Priority" as UC_UpdateStatus
    }

    package "Conversational Assistant & Alerts" {
        usecase "Ask LifeSynch Assistant" as UC_Ask
        usecase "Retrieve Contextual Records" as UC_RAG
        usecase "Receive Proactive Reminders" as UC_Remind
        usecase "Evaluate Deadline Thresholds" as UC_Threshold
        usecase "Filter Notification Feed" as UC_NotifFilter
    }
}

User --> UC_Ingest
User --> UC_Hub
User --> UC_Manage
User --> UC_Ask
User --> UC_Remind

UC_Ingest .> UC_Auth : <<include>>
UC_SyncGmail -|> UC_Ingest
UC_SyncCal -|> UC_Ingest
UC_SyncGmail --> Gmail
UC_SyncCal --> Calendar

UC_Extract .> UC_Filter : <<include>>
UC_Extract .> UC_Zod : <<include>>
UC_Extract .> UC_Dedup : <<include>>
UC_Extract --> LLM
UC_OppModal .> UC_WorthKnowing : <<extend>>

UC_Hub .> UC_Urgency : <<include>>
UC_CatFilter .> UC_Hub : <<extend>>
UC_RespModal .> UC_Manage : <<extend>>
UC_UpdateStatus .> UC_Manage : <<extend>>

UC_Ask .> UC_RAG : <<include>>
UC_Ask --> LLM

UC_Remind .> UC_Threshold : <<include>>
UC_NotifFilter .> UC_Remind : <<extend>>

@enduml
`;

const detailedUseCaseMMD = `flowchart TD
    subgraph Actors ["Actors"]
        U["fa:fa-user User"]
        GM["fa:fa-envelope Gmail API"]
        GC["fa:fa-calendar Google Calendar"]
        AI["fa:fa-brain Gemini LLM"]
    end

    subgraph SystemBoundary ["LifeSynch AI System Boundary"]
        subgraph Sub1 ["Data Ingestion & Auth"]
            I["Ingest Digital Sources"]
            V["Verify OAuth Session"]
            SG["Sync Gmail Messages"]
            SC["Sync Calendar Events"]
        end

        subgraph Sub2 ["AI Extraction & Intelligence"]
            E["Extract Responsibilities"]
            NF["Filter Non-Actionable Content"]
            ZV["Validate Schema via Zod"]
            DD["Deduplicate Records"]
            WK["Surface Worth Knowing Items"]
            OM["View Opportunity Modal"]
        end

        subgraph Sub3 ["Intelligence Hub & Lifecycle Tracking"]
            VH["View Intelligence Hub"]
            CU["Calculate Dynamic Urgency"]
            CF["Filter by Category"]
            MR["Manage Responsibilities"]
            RD["View Responsibility Modal"]
            US["Update Status & Priority"]
        end

        subgraph Sub4 ["Conversational Assistant & Alerts"]
            AS["Ask LifeSynch Assistant"]
            CR["Retrieve Contextual Records"]
            PR["Receive Proactive Reminders"]
            ET["Evaluate Deadline Thresholds"]
            FN["Filter Notification Feed"]
        end
    end

    U --> I
    U --> VH
    U --> MR
    U --> AS
    U --> PR

    I -. "<<include>>" .-> V
    SG --> I
    SC --> I
    SG --> GM
    SC --> GC

    E -. "<<include>>" .-> NF
    E -. "<<include>>" .-> ZV
    E -. "<<include>>" .-> DD
    E --> AI
    OM -. "<<extend>>" .-> WK

    VH -. "<<include>>" .-> CU
    CF -. "<<extend>>" .-> VH
    RD -. "<<extend>>" .-> MR
    US -. "<<extend>>" .-> MR

    AS -. "<<include>>" .-> CR
    AS --> AI

    PR -. "<<include>>" .-> ET
    FN -. "<<extend>>" .-> PR
`;

const detailedUseCaseSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1350 920" width="1350" height="920">
  <defs>
    <style>
      .bg { fill: #ffffff; }
      .title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 20px; font-weight: bold; fill: #0f172a; text-anchor: middle; }
      .subtitle { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; fill: #64748b; text-anchor: middle; }
      .sys-rect { fill: #fcfdfd; stroke: #94a3b8; stroke-width: 2; stroke-dasharray: 6,4; rx: 14; }
      .pkg-box { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1.5; rx: 10; }
      .pkg-hdr { fill: #f8fafc; stroke: #cbd5e1; stroke-width: 1.5; }
      .pkg-title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: bold; fill: #1e293b; }
      .actor-card { fill: #f0f9ff; stroke: #0284c7; stroke-width: 2; rx: 10; }
      .actor-ext { fill: #f8fafc; stroke: #475569; stroke-width: 1.8; rx: 10; }
      .actor-txt { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: bold; fill: #0f172a; text-anchor: middle; }
      .uc-main { fill: #f0f9ff; stroke: #0284c7; stroke-width: 1.8; rx: 18; }
      .uc-sub { fill: #ffffff; stroke: #64748b; stroke-width: 1.4; rx: 16; }
      .uc-txt { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11.5px; font-weight: 600; fill: #0f172a; text-anchor: middle; }
      .uc-txt-sub { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; fill: #334155; text-anchor: middle; }
      .rel-lbl { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9.5px; font-weight: bold; fill: #0369a1; text-anchor: middle; background: #ffffff; }
      .line { stroke: #64748b; stroke-width: 1.4; fill: none; }
      .line-dash { stroke: #0284c7; stroke-width: 1.4; stroke-dasharray: 4,3; fill: none; }
      .line-accent { stroke: #0284c7; stroke-width: 1.8; fill: none; }
    </style>
    <marker id="arr2" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
      <polygon points="0 0, 7 3.5, 0 7" fill="#64748b" />
    </marker>
    <marker id="arr2-acc" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
      <polygon points="0 0, 7 3.5, 0 7" fill="#0284c7" />
    </marker>
  </defs>

  <rect width="100%" height="100%" class="bg" />

  <text x="675" y="38" class="title">LifeSynch AI — Detailed Use Case Diagram</text>
  <text x="675" y="58" class="subtitle">Component Sub-Packages, Stereotyped &lt;&lt;include&gt;&gt; / &lt;&lt;extend&gt;&gt; Relationships, and Actor Linkages</text>

  <!-- Left: User Actor -->
  <g transform="translate(60, 440)">
    <rect x="-45" y="-55" width="90" height="120" class="actor-card" />
    <circle cx="0" cy="-20" r="13" fill="#0284c7" />
    <path d="M 0 -7 L 0 24 M -18 4 L 18 4 M 0 24 L -12 48 M 0 24 L 12 48" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <text x="0" y="58" class="actor-txt">User</text>
  </g>

  <!-- System Boundary -->
  <rect x="160" y="80" width="1010" height="810" class="sys-rect" />
  <text x="180" y="105" font-family="'Segoe UI', Arial" font-size="13" font-weight="bold" fill="#475569">SYSTEM: LifeSynch AI Platform</text>

  <!-- 4 Sub-Packages inside boundary -->

  <!-- PACKAGE 1: Data Ingestion & Auth -->
  <g transform="translate(180, 120)">
    <rect x="0" y="0" width="460" height="340" class="pkg-box" />
    <path d="M 0 0 L 170 0 L 185 24 L 0 24 Z" class="pkg-hdr" />
    <text x="12" y="17" class="pkg-title">Data Ingestion &amp; Auth</text>

    <!-- Main UC: Ingest Digital Sources -->
    <rect x="20" y="45" width="180" height="42" class="uc-main" />
    <text x="110" y="71" class="uc-txt">Ingest Digital Sources</text>

    <!-- Included: Verify OAuth -->
    <rect x="250" y="45" width="185" height="40" class="uc-sub" />
    <text x="342" y="70" class="uc-txt-sub">Verify OAuth 2.0 Session</text>
    <path d="M 200 66 L 250 66" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="225" y="60" class="rel-lbl">&lt;&lt;include&gt;&gt;</text>

    <!-- Sync Gmail -->
    <rect x="250" y="120" width="185" height="40" class="uc-sub" />
    <text x="342" y="145" class="uc-txt-sub">Sync Gmail (Inbox/Spam)</text>
    <path d="M 110 87 C 110 140, 160 140, 250 140" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="170" y="132" class="rel-lbl">&lt;&lt;extend&gt;&gt;</text>

    <!-- Sync Calendar -->
    <rect x="250" y="185" width="185" height="40" class="uc-sub" />
    <text x="342" y="210" class="uc-txt-sub">Sync Google Calendar Events</text>
    <path d="M 110 87 C 110 205, 160 205, 250 205" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="170" y="198" class="rel-lbl">&lt;&lt;extend&gt;&gt;</text>

    <!-- Window Focus & 10s Timer -->
    <rect x="250" y="255" width="185" height="40" class="uc-sub" />
    <text x="342" y="280" class="uc-txt-sub">10s Polling / Window Focus</text>
    <path d="M 110 87 C 110 275, 160 275, 250 275" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="170" y="268" class="rel-lbl">&lt;&lt;include&gt;&gt;</text>
  </g>

  <!-- PACKAGE 2: AI Extraction & Intelligence -->
  <g transform="translate(680, 120)">
    <rect x="0" y="0" width="470" height="340" class="pkg-box" />
    <path d="M 0 0 L 210 0 L 225 24 L 0 24 Z" class="pkg-hdr" />
    <text x="12" y="17" class="pkg-title">AI Extraction &amp; Intelligence</text>

    <!-- Main UC: Extract Responsibilities -->
    <rect x="20" y="45" width="185" height="42" class="uc-main" />
    <text x="112" y="71" class="uc-txt">Extract Responsibilities</text>

    <!-- Included: Filter Non-Actionable -->
    <rect x="260" y="45" width="190" height="38" class="uc-sub" />
    <text x="355" y="69" class="uc-txt-sub">Filter Non-Actionable Emails</text>
    <path d="M 205 66 L 260 66" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="232" y="60" class="rel-lbl">&lt;&lt;include&gt;&gt;</text>

    <!-- Included: Zod Schema Validation -->
    <rect x="260" y="105" width="190" height="38" class="uc-sub" />
    <text x="355" y="129" class="uc-txt-sub">Zod Structured Output Schema</text>
    <path d="M 112 87 C 112 124, 170 124, 260 124" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="180" y="117" class="rel-lbl">&lt;&lt;include&gt;&gt;</text>

    <!-- Included: Deduplication & Reconcile -->
    <rect x="260" y="165" width="190" height="38" class="uc-sub" />
    <text x="355" y="189" class="uc-txt-sub">Deduplicate &amp; Match Sources</text>
    <path d="M 112 87 C 112 184, 170 184, 260 184" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="180" y="176" class="rel-lbl">&lt;&lt;include&gt;&gt;</text>

    <!-- Surface Worth Knowing -->
    <rect x="20" y="240" width="185" height="42" class="uc-main" />
    <text x="112" y="266" class="uc-txt">Surface "Worth Knowing"</text>

    <!-- Opportunity Modal -->
    <rect x="260" y="240" width="190" height="40" class="uc-sub" />
    <text x="355" y="265" class="uc-txt-sub">View Opportunity Modal</text>
    <path d="M 205 261 L 260 261" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="232" y="254" class="rel-lbl">&lt;&lt;extend&gt;&gt;</text>
  </g>

  <!-- PACKAGE 3: Intelligence Hub & Tracking -->
  <g transform="translate(180, 490)">
    <rect x="0" y="0" width="460" height="375" class="pkg-box" />
    <path d="M 0 0 L 220 0 L 235 24 L 0 24 Z" class="pkg-hdr" />
    <text x="12" y="17" class="pkg-title">Intelligence Hub &amp; Tracking</text>

    <!-- View Hub -->
    <rect x="20" y="45" width="180" height="42" class="uc-main" />
    <text x="110" y="71" class="uc-txt">View Intelligence Hub</text>

    <!-- Recalculate Urgency -->
    <rect x="250" y="45" width="185" height="38" class="uc-sub" />
    <text x="342" y="69" class="uc-txt-sub">Recalculate Dynamic Urgency</text>
    <path d="M 200 66 L 250 66" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="225" y="60" class="rel-lbl">&lt;&lt;include&gt;&gt;</text>

    <!-- Filter Category -->
    <rect x="250" y="105" width="185" height="38" class="uc-sub" />
    <text x="342" y="129" class="uc-txt-sub">Filter by Life Category</text>
    <path d="M 110 87 C 110 124, 160 124, 250 124" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="170" y="116" class="rel-lbl">&lt;&lt;extend&gt;&gt;</text>

    <!-- Manage Responsibilities -->
    <rect x="20" y="200" width="180" height="42" class="uc-main" />
    <text x="110" y="226" class="uc-txt">Manage Responsibilities</text>

    <!-- Responsibility Details Modal -->
    <rect x="250" y="180" width="185" height="38" class="uc-sub" />
    <text x="342" y="204" class="uc-txt-sub">View Responsibility Modal</text>
    <path d="M 200 215 C 215 210, 230 200, 250 199" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="225" y="195" class="rel-lbl">&lt;&lt;extend&gt;&gt;</text>

    <!-- Update Status & Category -->
    <rect x="250" y="240" width="185" height="38" class="uc-sub" />
    <text x="342" y="264" class="uc-txt-sub">Update Status / Category</text>
    <path d="M 200 225 C 215 235, 230 250, 250 255" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="225" y="248" class="rel-lbl">&lt;&lt;extend&gt;&gt;</text>
  </g>

  <!-- PACKAGE 4: Conversational Assistant & Alerts -->
  <g transform="translate(680, 490)">
    <rect x="0" y="0" width="470" height="375" class="pkg-box" />
    <path d="M 0 0 L 235 0 L 250 24 L 0 24 Z" class="pkg-hdr" />
    <text x="12" y="17" class="pkg-title">Conversational Assistant &amp; Alerts</text>

    <!-- Ask Assistant -->
    <rect x="20" y="45" width="185" height="42" class="uc-main" />
    <text x="112" y="71" class="uc-txt">Ask LifeSynch Assistant</text>

    <!-- Contextual Record Retrieval -->
    <rect x="260" y="45" width="190" height="38" class="uc-sub" />
    <text x="355" y="69" class="uc-txt-sub">Retrieve Contextual Records</text>
    <path d="M 205 66 L 260 66" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="232" y="60" class="rel-lbl">&lt;&lt;include&gt;&gt;</text>

    <!-- Fallback Deterministic Engine -->
    <rect x="260" y="105" width="190" height="38" class="uc-sub" />
    <text x="355" y="129" class="uc-txt-sub">Deterministic Query Fallback</text>
    <path d="M 112 87 C 112 124, 170 124, 260 124" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="180" y="117" class="rel-lbl">&lt;&lt;extend&gt;&gt;</text>

    <!-- Receive Reminders -->
    <rect x="20" y="200" width="185" height="42" class="uc-main" />
    <text x="112" y="226" class="uc-txt">Receive Reminders</text>

    <!-- Evaluate 24/48h Threshold -->
    <rect x="260" y="180" width="190" height="38" class="uc-sub" />
    <text x="355" y="204" class="uc-txt-sub">Evaluate 24h/48h Deadlines</text>
    <path d="M 205 215 C 220 210, 235 200, 260 199" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="232" y="195" class="rel-lbl">&lt;&lt;include&gt;&gt;</text>

    <!-- Filter Notification Feed -->
    <rect x="260" y="240" width="190" height="38" class="uc-sub" />
    <text x="355" y="264" class="uc-txt-sub">Filter by Deadlines / Cal</text>
    <path d="M 205 225 C 220 235, 235 250, 260 255" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="232" y="248" class="rel-lbl">&lt;&lt;extend&gt;&gt;</text>

    <!-- Mark As Read -->
    <rect x="260" y="300" width="190" height="38" class="uc-sub" />
    <text x="355" y="324" class="uc-txt-sub">Mark Reminder As Read</text>
    <path d="M 112 242 C 112 319, 170 319, 260 319" class="line-dash" marker-end="url(#arr2-acc)" />
    <text x="180" y="312" class="rel-lbl">&lt;&lt;extend&gt;&gt;</text>
  </g>

  <!-- External Actors on Right -->
  <g transform="translate(1260, 230)">
    <rect x="-65" y="-30" width="130" height="60" class="actor-ext" />
    <text x="0" y="5" class="actor-txt">Gmail API</text>
    <text x="0" y="19" font-family="'Segoe UI', Arial" font-size="10" fill="#475569" text-anchor="middle">&lt;&lt;Service&gt;&gt;</text>
  </g>

  <g transform="translate(1260, 340)">
    <rect x="-65" y="-30" width="130" height="60" class="actor-ext" />
    <text x="0" y="5" class="actor-txt">Google Calendar</text>
    <text x="0" y="19" font-family="'Segoe UI', Arial" font-size="10" fill="#475569" text-anchor="middle">&lt;&lt;Service&gt;&gt;</text>
  </g>

  <g transform="translate(1260, 520)">
    <rect x="-65" y="-30" width="130" height="60" class="actor-ext" />
    <text x="0" y="5" class="actor-txt">Gemini LLM</text>
    <text x="0" y="19" font-family="'Segoe UI', Arial" font-size="10" fill="#475569" text-anchor="middle">&lt;&lt;AI Engine&gt;&gt;</text>
  </g>

  <!-- Link Lines from User to Main Use Cases -->
  <path d="M 105 420 C 130 300, 140 186, 200 186" class="line-accent" />
  <path d="M 105 440 C 130 460, 140 556, 200 556" class="line-accent" />
  <path d="M 105 450 C 130 520, 140 711, 200 711" class="line-accent" />
  <path d="M 105 435 C 200 440, 500 556, 700 556" class="line-accent" />
  <path d="M 105 460 C 200 520, 500 711, 700 711" class="line-accent" />

  <!-- Link Lines to External Services -->
  <!-- Sync Gmail to Gmail API -->
  <path d="M 615 260 C 850 250, 1050 230, 1195 230" class="line" marker-end="url(#arr2)" />
  <!-- Sync Cal to Google Cal API -->
  <path d="M 615 325 C 850 330, 1050 340, 1195 340" class="line" marker-end="url(#arr2)" />
  <!-- Extract to Gemini LLM -->
  <path d="M 885 186 C 1050 200, 1180 450, 1195 510" class="line" marker-end="url(#arr2)" />
  <!-- Ask Assistant to Gemini LLM -->
  <path d="M 885 556 C 1000 556, 1120 530, 1195 525" class="line" marker-end="url(#arr2)" />

</svg>
`;

// ============================================================================
// 3. SYSTEM ARCHITECTURE DIAGRAM
// ============================================================================

const architecturePUML = `@startuml diagram-03-system-architecture
skinparam rectangleStyle rectangle
skinparam shadowing false
skinparam defaultFontName "Segoe UI, Arial, sans-serif"
skinparam defaultFontSize 11
skinparam roundCorner 8

skinparam rectangle {
    BackgroundColor #FFFFFF
    BorderColor #64748B
    FontColor #0F172A
}

rectangle "Presentation Tier (React 18 SPA Client)" as T1 #F0F9FF {
    rectangle "UI Views & Modals" {
        [Personal Intelligence Hub]
        [Responsibilities View]
        [Calendar Sync View]
        [Ask Assistant Chat]
        [Notifications Panel]
        [Opportunity / Details Modal]
    }
    rectangle "Client State & Offline Layer" {
        [AuthContext (JWT Session)]
        [dataCache (LocalStorage Fast Load)]
        [Window-Focus & 10s Ticker]
    }
    rectangle "Chrome Extension Companion" {
        [Manifest V3 Background Service]
    }
}

rectangle "API Gateway & Security Tier (Express.js)" as T2 #F8FAFC {
    rectangle "Middlewares" {
        [auth.middleware (JWT Guard)]
        [validate.middleware (Zod)]
        [error.middleware (RFC 7807)]
        [cors & body-parser]
    }
    rectangle "REST Route Controllers (/api/v1)" {
        [/auth (Google OAuth)]
        [/tasks (Responsibilities)]
        [/sync (Gmail/Cal Sync)]
        [/reminders (Alerts)]
        [/assistant (Conversational Chat)]
    }
}

rectangle "Core Intelligence & Business Logic Tier" as T3 #FEF3C7 {
    rectangle "Domain Services" {
        [TaskService (Lifecycle & Status)]
        [AutoSyncService (10s Polling)]
        [ReminderService (Threshold Engine)]
    }
    rectangle "AI Extraction & NLP Pipeline" {
        [ExtractionService (Schema Prompting)]
        [ResponsibilityGenerationService (Multi-pass)]
        [ResponsibilityMatcher (Urgency/Timing)]
        [AssistantService (RAG + Fallback)]
    }
    rectangle "Google Integration Layer" {
        [OAuthService (Token Refresh)]
        [GmailService (Batch Threads)]
        [CalendarService (Events Sync)]
    }
}

rectangle "Data Storage & External Services Tier" as T4 #ECFDF5 {
    database "Supabase PostgreSQL (RLS)" {
        [users & connected_accounts]
        [emails & calendar_events]
        [responsibilities & notifications]
        [sync_state]
    }
    cloud "External Services" {
        [Google Cloud: Gmail & Calendar APIs]
        [Google Cloud: OAuth 2.0 Provider]
        [Google Gemini AI: gemini-1.5-flash]
    }
}

T1 --> T2 : HTTPS / REST (/api/v1)
T2 --> T3 : Internal Service Invocations
T3 --> T4 : Supabase Service Client & Google/Gemini SDKs

@enduml
`;

const architectureMMD = `flowchart TD
    subgraph T1 ["Tier 1: Client / Presentation Tier (React 18 + Vite)"]
        direction TB
        V1["Personal Intelligence Hub"]
        V2["Responsibilities & Lifecycle View"]
        V3["Calendar Sync & Timeline View"]
        V4["Ask LifeSynch Chatbot"]
        V5["Notifications & Alert Center"]
        V6["Modals (Responsibility, Worth Knowing)"]
        AC["AuthContext (JWT State)"]
        DC["dataCache (LocalStorage)"]
        EXT["Chrome Extension Manifest V3"]
    end

    subgraph T2 ["Tier 2: API Gateway & Security Tier (Express.js REST API)"]
        direction TB
        MW1["auth.middleware (JWT Guard)"]
        MW2["validate.middleware (Zod)"]
        MW3["error.middleware (Centralized)"]
        RC1["/api/v1/auth"]
        RC2["/api/v1/tasks"]
        RC3["/api/v1/sync"]
        RC4["/api/v1/reminders"]
        RC5["/api/v1/assistant"]
    end

    subgraph T3 ["Tier 3: Core Intelligence & Business Logic Tier"]
        direction TB
        S1["TaskService (Lifecycle & CRUD)"]
        S2["AutoSyncService (10s Polling & Focus)"]
        S3["ReminderService (24h/48h Engine)"]
        AI1["ExtractionService (Zod Structured Schemas)"]
        AI2["ResponsibilityGenerationService (Multi-pass Filter)"]
        AI3["ResponsibilityMatcher (Urgency & Timing)"]
        AI4["AssistantService (RAG Retrieval + Deterministic Fallback)"]
        G1["OAuthService (Token Refresh)"]
        G2["GmailService (Messages & Spam)"]
        G3["CalendarService (Events Fetcher)"]
    end

    subgraph T4 ["Tier 4: Data Storage & External Cloud Services"]
        direction TB
        DB[("Supabase PostgreSQL (RLS)<br/>users, connected_accounts, emails,<br/>responsibilities, calendar_events, notifications, sync_state")]
        EXT_G["Google Cloud APIs (Gmail, Calendar, OAuth 2.0)"]
        EXT_AI["Google Gemini AI (gemini-1.5-flash)"]
    end

    T1 ==>|HTTPS / REST| T2
    T2 ==>|Service Calls| T3
    T3 ==>|Supabase Admin SDK| DB
    T3 ==>|OAuth & REST| EXT_G
    T3 ==>|Generative AI API| EXT_AI
`;

const architectureSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1350 960" width="1350" height="960">
  <defs>
    <style>
      .bg { fill: #ffffff; }
      .title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 20px; font-weight: bold; fill: #0f172a; text-anchor: middle; }
      .subtitle { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; fill: #64748b; text-anchor: middle; }
      .tier-rect { rx: 12; stroke-width: 1.8; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.03)); }
      .t1-bg { fill: #f8fafc; stroke: #0284c7; }
      .t2-bg { fill: #faf5ff; stroke: #9333ea; }
      .t3-bg { fill: #fffbeb; stroke: #d97706; }
      .t4-bg { fill: #f0fdf4; stroke: #059669; }
      .tier-title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: bold; }
      .tier-sub { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; fill: #64748b; }
      .comp-box { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1.2; rx: 8; }
      .comp-title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: bold; fill: #0f172a; text-anchor: middle; }
      .comp-sub { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9.5px; fill: #64748b; text-anchor: middle; }
      .conn-line { stroke: #64748b; stroke-width: 2.2; fill: none; }
      .conn-arrow { fill: #64748b; }
    </style>
    <marker id="downarr" markerWidth="8" markerHeight="8" refX="4" refY="7" orient="auto">
      <polygon points="0 0, 8 0, 4 7" class="conn-arrow" />
    </marker>
  </defs>

  <rect width="100%" height="100%" class="bg" />

  <text x="675" y="36" class="title">LifeSynch AI — 4-Tier System Architecture Diagram</text>
  <text x="675" y="56" class="subtitle">Component Decomposition across Client, API Gateway, Intelligence Logic, and Cloud Persistence</text>

  <!-- ================= TIER 1 ================= -->
  <g transform="translate(60, 75)">
    <rect width="1230" height="175" class="tier-rect t1-bg" />
    <text x="25" y="28" class="tier-title" fill="#0369a1">TIER 1: PRESENTATION &amp; CLIENT APPLICATION</text>
    <text x="25" y="44" class="tier-sub">React 18 SPA, Vite, Tailwind CSS, Local Data Caching &amp; Chrome Extension Companion</text>

    <!-- Components row -->
    <g transform="translate(25, 60)">
      <!-- Hub -->
      <rect x="0" y="0" width="180" height="95" class="comp-box" />
      <text x="90" y="28" class="comp-title">Personal Intelligence Hub</text>
      <text x="90" y="46" class="comp-sub">Unified Categorized Feed</text>
      <text x="90" y="62" class="comp-sub">Academic, Career, Finance</text>
      <text x="90" y="78" class="comp-sub">Quick Metric Badges</text>

      <!-- Responsibilities -->
      <rect x="195" y="0" width="180" height="95" class="comp-box" />
      <text x="285" y="28" class="comp-title">Responsibilities View</text>
      <text x="285" y="46" class="comp-sub">Needs Attention Section</text>
      <text x="285" y="62" class="comp-sub">Upcoming Commitments</text>
      <text x="285" y="78" class="comp-sub">Action &amp; Next Step Derive</text>

      <!-- Calendar -->
      <rect x="390" y="0" width="180" height="95" class="comp-box" />
      <text x="480" y="28" class="comp-title">Calendar &amp; Events</text>
      <text x="480" y="46" class="comp-sub">Google Calendar Sync</text>
      <text x="480" y="62" class="comp-sub">Timeline &amp; Agenda Views</text>
      <text x="480" y="78" class="comp-sub">Event Detail Modal</text>

      <!-- Assistant -->
      <rect x="585" y="0" width="180" height="95" class="comp-box" />
      <text x="675" y="28" class="comp-title">Ask LifeSynch Chat</text>
      <text x="675" y="46" class="comp-sub">Conversational AI UI</text>
      <text x="675" y="62" class="comp-sub">Contextual Querying</text>
      <text x="675" y="78" class="comp-sub">Attributed Citations</text>

      <!-- Notifications -->
      <rect x="780" y="0" width="180" height="95" class="comp-box" />
      <text x="870" y="28" class="comp-title">Notification Center</text>
      <text x="870" y="46" class="comp-sub">Deadline Alert Popover</text>
      <text x="870" y="62" class="comp-sub">Category Filters</text>
      <text x="870" y="78" class="comp-sub">Mark-As-Read State</text>

      <!-- Caching & Extension -->
      <rect x="975" y="0" width="205" height="95" class="comp-box" />
      <text x="1077" y="28" class="comp-title">Client State &amp; Companion</text>
      <text x="1077" y="46" class="comp-sub">AuthContext (JWT Session)</text>
      <text x="1077" y="62" class="comp-sub">dataCache (LocalStorage)</text>
      <text x="1077" y="78" class="comp-sub">Chrome Extension Manifest V3</text>
    </g>
  </g>

  <!-- Arrow T1 -> T2 -->
  <path d="M 675 250 L 675 285" class="conn-line" marker-end="url(#downarr)" />
  <text x="735" y="272" font-family="'Segoe UI', Arial" font-size="10.5" font-weight="bold" fill="#0284c7">HTTPS / REST JSON</text>

  <!-- ================= TIER 2 ================= -->
  <g transform="translate(60, 290)">
    <rect width="1230" height="150" class="tier-rect t2-bg" />
    <text x="25" y="26" class="tier-title" fill="#7e22ce">TIER 2: API GATEWAY &amp; REST INTERFACE</text>
    <text x="25" y="42" class="tier-sub">Node.js + Express.js HTTP Server, Security Guards, Validation Pipelines &amp; Route Dispatchers</text>

    <!-- Components row -->
    <g transform="translate(25, 55)">
      <rect x="0" y="0" width="275" height="80" class="comp-box" />
      <text x="137" y="26" class="comp-title">Security &amp; Auth Guards</text>
      <text x="137" y="44" class="comp-sub">auth.middleware (JWT Verification)</text>
      <text x="137" y="60" class="comp-sub">CORS Origin &amp; Secure Headers</text>

      <rect x="290" y="0" width="275" height="80" class="comp-box" />
      <text x="427" y="26" class="comp-title">Validation &amp; Error Handling</text>
      <text x="427" y="44" class="comp-sub">validate.middleware (Zod Schemas)</text>
      <text x="427" y="60" class="comp-sub">error.middleware (RFC 7807 Format)</text>

      <rect x="580" y="0" width="600" height="80" class="comp-box" />
      <text x="880" y="24" class="comp-title">RESTful API Endpoints (/api/v1)</text>
      <text x="880" y="42" class="comp-sub">/auth (Google OAuth)  |  /tasks (CRUD &amp; Lifecycle)  |  /sync (Gmail &amp; Calendar)</text>
      <text x="880" y="60" class="comp-sub">/reminders (Active Notifications)  |  /assistant (Conversational Chat)  |  /health</text>
    </g>
  </g>

  <!-- Arrow T2 -> T3 -->
  <path d="M 675 440 L 675 475" class="conn-line" marker-end="url(#downarr)" />
  <text x="745" y="462" font-family="'Segoe UI', Arial" font-size="10.5" font-weight="bold" fill="#7e22ce">Service Layer Invocation</text>

  <!-- ================= TIER 3 ================= -->
  <g transform="translate(60, 480)">
    <rect width="1230" height="215" class="tier-rect t3-bg" />
    <text x="25" y="26" class="tier-title" fill="#b45309">TIER 3: CORE INTELLIGENCE &amp; BUSINESS LOGIC TIER</text>
    <text x="25" y="42" class="tier-sub">AI Extraction Engine, Multi-Pass Filtering, Semantic Deduplication, Urgency Calculator &amp; Google Services</text>

    <!-- Components row -->
    <g transform="translate(25, 55)">
      <!-- AI Engine Cluster -->
      <rect x="0" y="0" width="460" height="145" class="comp-box" />
      <text x="230" y="24" class="comp-title" fill="#b45309">AI Intelligence &amp; NLP Extraction Pipeline</text>
      <text x="230" y="44" class="comp-sub">ExtractionService: Structured Output with Zod Schema Validation</text>
      <text x="230" y="62" class="comp-sub">ResponsibilityGenerationService: Multi-Pass Semantic Classification</text>
      <text x="230" y="80" class="comp-sub">Noise Suppression: Filters non-actionable updates, OTPs, promotional spam</text>
      <text x="230" y="98" class="comp-sub">ResponsibilityMatcher: Token Matching, Smart Timing &amp; Deduplication</text>
      <text x="230" y="116" class="comp-sub">AssistantService: Contextual Retrieval RAG + Deterministic Fallback</text>

      <!-- Business Domain Services -->
      <rect x="475" y="0" width="370" height="145" class="comp-box" />
      <text x="660" y="24" class="comp-title" fill="#b45309">Domain Lifecycle &amp; Scheduling Services</text>
      <text x="660" y="46" class="comp-sub">TaskService: Task Lifecycle, Priority Ordering, CRUD</text>
      <text x="660" y="66" class="comp-sub">AutoSyncService: 10s Polling Coordinator &amp; Window Focus</text>
      <text x="660" y="86" class="comp-sub">ReminderService: 24h &amp; 48h Deadline Proactive Engine</text>
      <text x="660" y="106" class="comp-sub">Reconciliation Engine: Status transitions (Overdue, Due Today)</text>
      <text x="660" y="126" class="comp-sub">Notification Dispatcher: Read state &amp; Category routing</text>

      <!-- Google Integration Boundary -->
      <rect x="860" y="0" width="320" height="145" class="comp-box" />
      <text x="1020" y="24" class="comp-title" fill="#b45309">Google Services Integration Boundary</text>
      <text x="1020" y="50" class="comp-sub">OAuthService: Consent URL &amp; Refresh Token Exchange</text>
      <text x="1020" y="74" class="comp-sub">GmailService: Batch Message Fetching &amp; Body Parsing</text>
      <text x="1020" y="98" class="comp-sub">CalendarService: Incremental Event Sync &amp; Recurrence</text>
      <text x="1020" y="122" class="comp-sub">Rate Limiter &amp; Exponential Backoff Retries</text>
    </g>
  </g>

  <!-- Arrow T3 -> T4 -->
  <path d="M 675 695 L 675 730" class="conn-line" marker-end="url(#downarr)" />
  <text x="740" y="717" font-family="'Segoe UI', Arial" font-size="10.5" font-weight="bold" fill="#059669">Database Client &amp; Cloud SDKs</text>

  <!-- ================= TIER 4 ================= -->
  <g transform="translate(60, 735)">
    <rect width="1230" height="175" class="tier-rect t4-bg" />
    <text x="25" y="26" class="tier-title" fill="#047857">TIER 4: DATA STORAGE &amp; EXTERNAL CLOUD SERVICES</text>
    <text x="25" y="42" class="tier-sub">PostgreSQL via Supabase (Relational Database with RLS) &amp; Cloud API Providers</text>

    <!-- Components row -->
    <g transform="translate(25, 55)">
      <!-- Supabase Tables -->
      <rect x="0" y="0" width="580" height="100" class="comp-box" />
      <text x="290" y="24" class="comp-title" fill="#047857">Supabase PostgreSQL Relational Schema (Row Level Security)</text>
      <text x="290" y="44" class="comp-sub">users (Profiles, Google IDs)  |  connected_accounts (OAuth Tokens, Expiry)</text>
      <text x="290" y="62" class="comp-sub">emails (Headers, Snippets, Labels)  |  calendar_events (Start/End, Location)</text>
      <text x="290" y="80" class="comp-sub">responsibilities (Action, NextStep, DueDate, Status)  |  notifications  |  sync_state</text>

      <!-- External Google Services -->
      <rect x="595" y="0" width="300" height="100" class="comp-box" />
      <text x="745" y="26" class="comp-title" fill="#1e3a8a">Google Cloud Platform APIs</text>
      <text x="745" y="48" class="comp-sub">Gmail API v1 (Message Threads &amp; Metadata)</text>
      <text x="745" y="68" class="comp-sub">Google Calendar API v3 (Schedules &amp; Events)</text>
      <text x="745" y="88" class="comp-sub">Google Identity (OAuth 2.0 Token Authority)</text>

      <!-- Gemini AI API -->
      <rect x="910" y="0" width="270" height="100" class="comp-box" />
      <text x="1045" y="26" class="comp-title" fill="#6b21a8">Google Gemini Generative AI</text>
      <text x="1045" y="48" class="comp-sub">Model: gemini-1.5-flash</text>
      <text x="1045" y="68" class="comp-sub">Structured JSON Extraction Pipeline</text>
      <text x="1045" y="88" class="comp-sub">Contextual Conversational Assistant</text>
    </g>
  </g>

</svg>
`;

// ============================================================================
// 4. DATA FLOW DIAGRAM (DFD LEVEL 0 - CONTEXT DIAGRAM)
// ============================================================================

const dfdLevel0PUML = `@startuml diagram-04-dfd-level-0
skinparam shadowing false
skinparam defaultFontName "Segoe UI, Arial, sans-serif"
skinparam defaultFontSize 11

skinparam rectangle {
    BackgroundColor #F8FAFC
    BorderColor #334155
    FontColor #0F172A
}

skinparam circle {
    BackgroundColor #EFF6FF
    BorderColor #0284C7
    FontColor #0F172A
}

rectangle "User / Student" as User
rectangle "Google OAuth 2.0" as OAuth
rectangle "Gmail API Service" as Gmail
rectangle "Google Calendar API" as Calendar
rectangle "Gemini LLM Service" as LLM

rectangle "0.0\\nLifeSynch AI\\nPersonal Digital Life\\nManagement System" as P0 #E0F2FE

User --> P0 : Google Auth Trigger / User Queries / Task Status Updates
P0 --> User : Intelligence Dashboard / Prioritized Deadlines / Reminders / Answers

P0 --> OAuth : Authorization Request & Token Exchange
OAuth --> P0 : OAuth Tokens & Profile Identity

Gmail --> P0 : Raw Messages, Threads & Metadata
Calendar --> P0 : Calendar Events & Meeting Schedules

P0 --> LLM : Contextual Raw Text & Zod JSON Schemas
LLM --> P0 : Structured Responsibilities & Assistant Responses

@enduml
`;

const dfdLevel0MMD = `flowchart TD
    U["fa:fa-user User / Student"]
    OA["fa:fa-key Google OAuth 2.0"]
    GM["fa:fa-envelope Gmail API Service"]
    GC["fa:fa-calendar Google Calendar API"]
    AI["fa:fa-brain Gemini LLM Service"]

    P0(("0.0<br/>LifeSynch AI<br/>Personal Digital Life<br/>Management System"))

    U -->|"1. Auth Trigger & Credentials<br/>2. Status Updates & Category Changes<br/>3. Conversational Questions"| P0
    P0 -->|"1. Personalized Intelligence Feed<br/>2. Prioritized Responsibilities & Due Dates<br/>3. Proactive Reminders & Grounded Answers"| U

    P0 -->|"Auth Code & Token Refresh Request"| OA
    OA -->|"Access/Refresh Tokens & User Profile"| P0

    GM -->|"Raw Email Messages, Headers & Spam"| P0
    GC -->|"Scheduled Events, Times & Locations"| P0

    P0 -->|"Extraction Prompts & Structured Zod Schemas"| AI
    AI -->|"Extracted Responsibilities & Conversational Text"| P0

    style P0 fill:#e0f2fe,stroke:#0284c7,stroke-width:2.5px
    style U fill:#f0f9ff,stroke:#0284c7,stroke-width:2px
    style OA fill:#f8fafc,stroke:#475569,stroke-width:2px
    style GM fill:#fef2f2,stroke:#ef4444,stroke-width:2px
    style GC fill:#eff6ff,stroke:#3b82f6,stroke-width:2px
    style AI fill:#faf5ff,stroke:#a855f7,stroke-width:2px
`;

const dfdLevel0SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 850" width="1200" height="850">
  <defs>
    <style>
      .bg { fill: #ffffff; }
      .title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 20px; font-weight: bold; fill: #0f172a; text-anchor: middle; }
      .subtitle { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; fill: #64748b; text-anchor: middle; }
      .entity-box { fill: #f8fafc; stroke: #334155; stroke-width: 2; rx: 8; }
      .entity-title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; font-weight: bold; fill: #0f172a; text-anchor: middle; }
      .entity-tag { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; fill: #64748b; text-anchor: middle; }
      .process-circle { fill: #f0f9ff; stroke: #0284c7; stroke-width: 3; filter: drop-shadow(0 4px 10px rgba(2,132,199,0.12)); }
      .proc-num { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: bold; fill: #0369a1; text-anchor: middle; }
      .proc-title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 15px; font-weight: bold; fill: #0f172a; text-anchor: middle; }
      .proc-sub { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; fill: #334155; text-anchor: middle; }
      .df-line { stroke: #0284c7; stroke-width: 1.8; fill: none; }
      .df-line-sec { stroke: #64748b; stroke-width: 1.6; fill: none; }
      .df-txt { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: 600; fill: #0f172a; }
      .df-txt-bg { fill: #ffffff; opacity: 0.95; }
      .arrow { fill: #0284c7; }
      .arrow-sec { fill: #64748b; }
    </style>
    <marker id="df-arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M 0 0 L 8 4 L 0 8 Z" class="arrow" />
    </marker>
    <marker id="df-arr-sec" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M 0 0 L 8 4 L 0 8 Z" class="arrow-sec" />
    </marker>
  </defs>

  <rect width="100%" height="100%" class="bg" />

  <text x="600" y="42" class="title">LifeSynch AI — Data Flow Diagram (DFD Level 0: Context Diagram)</text>
  <text x="600" y="65" class="subtitle">System Context, External Interfacing Entities, and High-Level Inbound/Outbound Data Flows</text>

  <!-- Central Process 0.0 -->
  <g transform="translate(600, 440)">
    <circle r="140" class="process-circle" />
    <line x1="-120" y1="-50" x2="120" y2="-50" stroke="#0284c7" stroke-width="1.5" />
    <text x="0" y="-70" class="proc-num">0.0</text>
    <text x="0" y="-12" class="proc-title">LifeSynch AI</text>
    <text x="0" y="12" class="proc-title">Personal Digital Life</text>
    <text x="0" y="36" class="proc-title">Management System</text>
    <line x1="-120" y1="58" x2="120" y2="58" stroke="#0284c7" stroke-width="1" stroke-dasharray="3,3" />
    <text x="0" y="80" class="proc-sub">Autonomous Aggregation &amp; Tracking</text>
  </g>

  <!-- External Entity 1: User / Student (Left) -->
  <g transform="translate(130, 440)">
    <rect x="-85" y="-55" width="170" height="110" class="entity-box" />
    <text x="0" y="-15" class="entity-title">User / Student</text>
    <text x="0" y="6" class="entity-tag">[Primary Entity]</text>
    <text x="0" y="28" font-family="'Segoe UI', Arial" font-size="10" fill="#475569" text-anchor="middle">Student / Individual</text>
  </g>

  <!-- External Entity 2: Google OAuth 2.0 (Top Left) -->
  <g transform="translate(250, 150)">
    <rect x="-95" y="-45" width="190" height="90" class="entity-box" />
    <text x="0" y="-10" class="entity-title">Google OAuth 2.0</text>
    <text x="0" y="10" class="entity-tag">[Identity Provider]</text>
    <text x="0" y="26" font-family="'Segoe UI', Arial" font-size="9.5" fill="#475569" text-anchor="middle">Consent &amp; Token Exchange</text>
  </g>

  <!-- External Entity 3: Gmail API (Top Right) -->
  <g transform="translate(950, 150)">
    <rect x="-95" y="-45" width="190" height="90" class="entity-box" />
    <text x="0" y="-10" class="entity-title">Gmail API Service</text>
    <text x="0" y="10" class="entity-tag">[Digital Data Source]</text>
    <text x="0" y="26" font-family="'Segoe UI', Arial" font-size="9.5" fill="#475569" text-anchor="middle">Emails, Threads, Spam</text>
  </g>

  <!-- External Entity 4: Google Calendar (Middle Right) -->
  <g transform="translate(1050, 440)">
    <rect x="-95" y="-45" width="190" height="90" class="entity-box" />
    <text x="0" y="-10" class="entity-title">Google Calendar API</text>
    <text x="0" y="10" class="entity-tag">[Digital Data Source]</text>
    <text x="0" y="26" font-family="'Segoe UI', Arial" font-size="9.5" fill="#475569" text-anchor="middle">Schedules, Deadlines, Events</text>
  </g>

  <!-- External Entity 5: Gemini LLM (Bottom Right) -->
  <g transform="translate(950, 720)">
    <rect x="-95" y="-45" width="190" height="90" class="entity-box" />
    <text x="0" y="-10" class="entity-title">Gemini LLM Service</text>
    <text x="0" y="10" class="entity-tag">[AI Extraction &amp; Chat Engine]</text>
    <text x="0" y="26" font-family="'Segoe UI', Arial" font-size="9.5" fill="#475569" text-anchor="middle">Structured JSON &amp; RAG</text>
  </g>

  <!-- Data Flows between User and 0.0 -->
  <!-- User to System -->
  <path d="M 215 410 L 460 410" class="df-line" marker-end="url(#df-arr)" />
  <rect x="235" y="380" width="205" height="24" rx="4" class="df-txt-bg" />
  <text x="240" y="396" class="df-txt">1. Login Trigger &amp; Query Prompts</text>
  <text x="240" y="426" class="df-txt" fill="#64748b">2. Task Status / Category Updates</text>

  <!-- System to User -->
  <path d="M 460 470 L 215 470" class="df-line" marker-end="url(#df-arr)" />
  <rect x="235" y="482" width="210" height="28" rx="4" class="df-txt-bg" />
  <text x="240" y="496" class="df-txt">1. Personalized Intelligence Feed</text>
  <text x="240" y="508" class="df-txt">2. Prioritized Deadlines &amp; Reminders</text>

  <!-- Data Flows between Google OAuth and 0.0 -->
  <!-- System to OAuth -->
  <path d="M 520 330 C 420 270, 350 250, 310 195" class="df-line-sec" marker-end="url(#df-arr-sec)" />
  <rect x="340" y="240" width="165" height="18" rx="3" class="df-txt-bg" />
  <text x="345" y="253" class="df-txt">Authorization Request URL</text>

  <!-- OAuth to System -->
  <path d="M 260 195 C 290 280, 410 340, 485 365" class="df-line-sec" marker-end="url(#df-arr-sec)" />
  <rect x="270" y="305" width="180" height="18" rx="3" class="df-txt-bg" />
  <text x="275" y="318" class="df-txt">Access/Refresh Tokens &amp; Profile</text>

  <!-- Data Flows between Gmail and 0.0 -->
  <!-- Gmail to System -->
  <path d="M 865 190 C 780 250, 720 300, 680 320" class="df-line-sec" marker-end="url(#df-arr-sec)" />
  <rect x="740" y="240" width="190" height="18" rx="3" class="df-txt-bg" />
  <text x="745" y="253" class="df-txt">Raw Messages, Threads &amp; Spam</text>

  <!-- Data Flows between Google Calendar and 0.0 -->
  <!-- Calendar to System -->
  <path d="M 955 440 L 740 440" class="df-line-sec" marker-end="url(#df-arr-sec)" />
  <rect x="770" y="420" width="165" height="18" rx="3" class="df-txt-bg" />
  <text x="775" y="433" class="df-txt">Calendar Events &amp; Schedules</text>

  <!-- Data Flows between Gemini LLM and 0.0 -->
  <!-- System to Gemini -->
  <path d="M 680 540 C 740 600, 800 660, 865 690" class="df-line-sec" marker-end="url(#df-arr-sec)" />
  <rect x="720" y="605" width="200" height="18" rx="3" class="df-txt-bg" />
  <text x="725" y="618" class="df-txt">Text Prompts &amp; Zod Extraction Schemas</text>

  <!-- Gemini to System -->
  <path d="M 855 745 C 770 735, 680 660, 640 580" class="df-line-sec" marker-end="url(#df-arr-sec)" />
  <rect x="670" y="685" width="195" height="18" rx="3" class="df-txt-bg" />
  <text x="675" y="698" class="df-txt">Structured Responsibilities &amp; Answers</text>

</svg>
`;

// ============================================================================
// 5. DATA FLOW DIAGRAM (DFD LEVEL 1)
// ============================================================================

const dfdLevel1PUML = `@startuml diagram-05-dfd-level-1
skinparam shadowing false
skinparam defaultFontName "Segoe UI, Arial, sans-serif"
skinparam defaultFontSize 11

skinparam rectangle {
    BackgroundColor #F8FAFC
    BorderColor #334155
    FontColor #0F172A
}

skinparam circle {
    BackgroundColor #EFF6FF
    BorderColor #0284C7
    FontColor #0F172A
}

skinparam database {
    BackgroundColor #FEF3C7
    BorderColor #D97706
    FontColor #0F172A
}

rectangle "User / Student" as User
rectangle "Google OAuth 2.0" as OAuth
rectangle "Gmail API" as Gmail
rectangle "Google Calendar API" as Calendar
rectangle "Gemini LLM" as LLM

database "D1: Users & Accounts" as D1
database "D2: Ingested Digital Sources" as D2
database "D3: Structured Responsibilities" as D3
database "D4: Notifications & Reminders" as D4
database "D5: Sync State & Logs" as D5

circle "1.0\\nAuth & Source\\nAuthorization" as P1
circle "2.0\\nDigital Data\\nIngestion & Sync" as P2
circle "3.0\\nAI Extraction &\\nClassification" as P3
circle "4.0\\nDeadline Tracking\\n& Notifications" as P4
circle "5.0\\nConversational AI\\n& Unified Search" as P5

User --> P1 : Sign-in Request
P1 --> OAuth : Code Exchange
OAuth --> P1 : Tokens & Profile
P1 --> D1 : Store User & Tokens
P1 --> User : JWT Session Token

D1 --> P2 : Read OAuth Credentials
Gmail --> P2 : Fetch Emails & Threads
Calendar --> P2 : Fetch Calendar Events
P2 --> D2 : Store Raw Emails & Events
P2 --> D5 : Record Sync Timestamp & Status

D2 --> P3 : Unprocessed Emails & Events
P3 --> LLM : Extraction Prompts & Schemas
LLM --> P3 : Structured Action Items
P3 --> D3 : Store Validated Responsibilities & Discoveries

D3 --> P4 : Active Responsibilities
D2 --> P4 : Synced Calendar Dates
P4 --> D4 : Store Proactive Reminders
P4 --> User : Personalized Dashboard Feed & Deadline Alerts

User --> P5 : Ask Assistant Query / Search Keyword
D2 --> P5 : Source Context Records
D3 --> P5 : Current Responsibilities
D4 --> P5 : Active Notifications
P5 --> LLM : Grounded RAG Prompt
LLM --> P5 : Generated Synthesis
P5 --> User : Grounded Answer & Search Matches

@enduml
`;

const dfdLevel1MMD = `flowchart TD
    U["fa:fa-user User / Student"]
    OA["fa:fa-key Google OAuth 2.0"]
    GM["fa:fa-envelope Gmail API"]
    GC["fa:fa-calendar Google Calendar API"]
    AI["fa:fa-brain Gemini LLM Engine"]

    subgraph DataStores ["Data Stores (Supabase PostgreSQL)"]
        D1[("D1: Users & Connected Accounts")]
        D2[("D2: Ingested Sources (emails, calendar_events)")]
        D3[("D3: Structured Responsibilities")]
        D4[("D4: Notifications & Reminders")]
        D5[("D5: Sync State & System Logs")]
    end

    subgraph Processes ["Sub-Processes (DFD Level 1)"]
        P1(("1.0<br/>Authentication &<br/>Source Auth"))
        P2(("2.0<br/>Digital Data<br/>Ingestion & Sync"))
        P3(("3.0<br/>AI Extraction &<br/>Classification"))
        P4(("4.0<br/>Deadline Tracking<br/>& Reminders"))
        P5(("5.0<br/>Conversational AI<br/>& Unified Search"))
    end

    U -->|"Sign-in Request"| P1
    P1 -->|"Exchange Auth Code"| OA
    OA -->|"Tokens & Identity Profile"| P1
    P1 -->|"Persist User Profile & Tokens"| D1
    P1 -->|"Issue JWT Session Token"| U

    D1 -->|"Read Access Tokens"| P2
    GM -->|"Fetch Batch Messages"| P2
    GC -->|"Fetch Calendar Events"| P2
    P2 -->|"Write Raw Records"| D2
    P2 -->|"Update Last Sync Time"| D5

    D2 -->|"Unprocessed Raw Context"| P3
    P3 -->|"Send Schema & Text"| AI
    AI -->|"Return Structured JSON"| P3
    P3 -->|"Store Validated Tasks & Insights"| D3

    D3 -->|"Read Active Deadlines"| P4
    D2 -->|"Read Scheduled Events"| P4
    P4 -->|"Write 24h/48h Alerts"| D4
    P4 -->|"Deliver Unified Dashboard"| U

    U -->|"Submit Chat Query or Search"| P5
    D2 -->|"Contextual Email/Cal Records"| P5
    D3 -->|"Matching Responsibilities"| P5
    D4 -->|"Active Reminders"| P5
    P5 -->|"Grounded Retrieval Prompt"| AI
    AI -->|"Contextual Synthesis"| P5
    P5 -->|"Present Formatted Answer"| U
`;

const dfdLevel1SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1350 960" width="1350" height="960">
  <defs>
    <style>
      .bg { fill: #ffffff; }
      .title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 20px; font-weight: bold; fill: #0f172a; text-anchor: middle; }
      .subtitle { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; fill: #64748b; text-anchor: middle; }
      .entity-box { fill: #f8fafc; stroke: #334155; stroke-width: 1.8; rx: 8; }
      .entity-title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11.5px; font-weight: bold; fill: #0f172a; text-anchor: middle; }
      .proc-circle { fill: #f0f9ff; stroke: #0284c7; stroke-width: 2.2; filter: drop-shadow(0 2px 6px rgba(2,132,199,0.08)); }
      .proc-num { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: bold; fill: #0369a1; text-anchor: middle; }
      .proc-title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: bold; fill: #0f172a; text-anchor: middle; }
      .dstore-box { fill: #fffbeb; stroke: #d97706; stroke-width: 1.6; rx: 4; }
      .dstore-title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5px; font-weight: bold; fill: #92400e; text-anchor: middle; }
      .dstore-sub { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; fill: #78350f; text-anchor: middle; }
      .line { stroke: #0284c7; stroke-width: 1.5; fill: none; }
      .line-sec { stroke: #64748b; stroke-width: 1.4; fill: none; }
      .line-dash { stroke: #0284c7; stroke-width: 1.4; stroke-dasharray: 4,3; fill: none; }
      .df-txt { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; font-weight: 600; fill: #0f172a; }
      .df-bg { fill: #ffffff; opacity: 0.95; }
    </style>
    <marker id="darr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
      <polygon points="0 0, 7 3.5, 0 7" fill="#0284c7" />
    </marker>
    <marker id="darr-sec" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
      <polygon points="0 0, 7 3.5, 0 7" fill="#64748b" />
    </marker>
  </defs>

  <rect width="100%" height="100%" class="bg" />

  <text x="675" y="36" class="title">LifeSynch AI — Data Flow Diagram (DFD Level 1)</text>
  <text x="675" y="56" class="subtitle">Detailed Functional Decomposition: 5 Sub-Processes, 5 Data Stores, External Entities, and Directed Flows</text>

  <!-- External Entities -->
  <!-- User (Left) -->
  <g transform="translate(80, 480)">
    <rect x="-65" y="-45" width="130" height="90" class="entity-box" />
    <text x="0" y="-10" class="entity-title">User / Student</text>
    <text x="0" y="10" font-family="'Segoe UI', Arial" font-size="9.5" fill="#64748b" text-anchor="middle">&lt;&lt;Primary Actor&gt;&gt;</text>
  </g>

  <!-- Google OAuth 2.0 (Top Left) -->
  <g transform="translate(180, 120)">
    <rect x="-70" y="-35" width="140" height="70" class="entity-box" />
    <text x="0" y="-4" class="entity-title">Google OAuth 2.0</text>
    <text x="0" y="14" font-family="'Segoe UI', Arial" font-size="9" fill="#64748b" text-anchor="middle">&lt;&lt;Identity Provider&gt;&gt;</text>
  </g>

  <!-- Gmail API (Top Center) -->
  <g transform="translate(560, 120)">
    <rect x="-70" y="-35" width="140" height="70" class="entity-box" />
    <text x="0" y="-4" class="entity-title">Gmail API</text>
    <text x="0" y="14" font-family="'Segoe UI', Arial" font-size="9" fill="#64748b" text-anchor="middle">&lt;&lt;Email Service&gt;&gt;</text>
  </g>

  <!-- Google Calendar API (Top Right) -->
  <g transform="translate(880, 120)">
    <rect x="-70" y="-35" width="140" height="70" class="entity-box" />
    <text x="0" y="-4" class="entity-title">Google Calendar</text>
    <text x="0" y="14" font-family="'Segoe UI', Arial" font-size="9" fill="#64748b" text-anchor="middle">&lt;&lt;Schedule Service&gt;&gt;</text>
  </g>

  <!-- Gemini LLM (Far Right) -->
  <g transform="translate(1240, 480)">
    <rect x="-65" y="-45" width="130" height="90" class="entity-box" />
    <text x="0" y="-10" class="entity-title">Gemini LLM</text>
    <text x="0" y="10" font-family="'Segoe UI', Arial" font-size="9.5" fill="#64748b" text-anchor="middle">&lt;&lt;AI Engine&gt;&gt;</text>
    <text x="0" y="26" font-family="'Segoe UI', Arial" font-size="8.5" fill="#9333ea" text-anchor="middle">gemini-1.5-flash</text>
  </g>

  <!-- ================= 5 SUB-PROCESSES ================= -->

  <!-- Process 1.0: Authentication & Source Authorization -->
  <g transform="translate(260, 270)">
    <circle r="60" class="proc-circle" />
    <line x1="-50" y1="-20" x2="50" y2="-20" stroke="#0284c7" stroke-width="1.2" />
    <text x="0" y="-30" class="proc-num">1.0</text>
    <text x="0" y="-2" class="proc-title">Authentication &amp;</text>
    <text x="0" y="16" class="proc-title">Authorization</text>
  </g>

  <!-- Process 2.0: Digital Data Ingestion & Auto-Sync -->
  <g transform="translate(720, 270)">
    <circle r="60" class="proc-circle" />
    <line x1="-50" y1="-20" x2="50" y2="-20" stroke="#0284c7" stroke-width="1.2" />
    <text x="0" y="-30" class="proc-num">2.0</text>
    <text x="0" y="-2" class="proc-title">Digital Data Ingestion</text>
    <text x="0" y="16" class="proc-title">&amp; Auto-Sync</text>
  </g>

  <!-- Process 3.0: AI Responsibility Extraction & Classification -->
  <g transform="translate(1040, 480)">
    <circle r="62" class="proc-circle" />
    <line x1="-52" y1="-22" x2="52" y2="-22" stroke="#0284c7" stroke-width="1.2" />
    <text x="0" y="-32" class="proc-num">3.0</text>
    <text x="0" y="-4" class="proc-title">AI Responsibility</text>
    <text x="0" y="14" class="proc-title">Extraction &amp; Classify</text>
  </g>

  <!-- Process 4.0: Deadline Tracking & Notifications -->
  <g transform="translate(420, 680)">
    <circle r="62" class="proc-circle" />
    <line x1="-52" y1="-22" x2="52" y2="-22" stroke="#0284c7" stroke-width="1.2" />
    <text x="0" y="-32" class="proc-num">4.0</text>
    <text x="0" y="-4" class="proc-title">Deadline Tracking</text>
    <text x="0" y="14" class="proc-title">&amp; Alerts Dispatch</text>
  </g>

  <!-- Process 5.0: Conversational AI & Unified Search -->
  <g transform="translate(860, 680)">
    <circle r="62" class="proc-circle" />
    <line x1="-52" y1="-22" x2="52" y2="-22" stroke="#0284c7" stroke-width="1.2" />
    <text x="0" y="-32" class="proc-num">5.0</text>
    <text x="0" y="-4" class="proc-title">Conversational AI</text>
    <text x="0" y="14" class="proc-title">&amp; Unified Search</text>
  </g>

  <!-- ================= 5 DATA STORES ================= -->
  <!-- D1: Users & Connected Accounts -->
  <g transform="translate(260, 480)">
    <rect x="-95" y="-25" width="190" height="50" class="dstore-box" />
    <line x1="-70" y1="-25" x2="-70" y2="25" stroke="#d97706" stroke-width="1.2" />
    <text x="25" y="-4" class="dstore-title">D1: Users &amp; Accounts</text>
    <text x="25" y="12" class="dstore-sub">Tokens, Scopes, Profiles</text>
  </g>

  <!-- D2: Ingested Digital Sources -->
  <g transform="translate(720, 480)">
    <rect x="-105" y="-25" width="210" height="50" class="dstore-box" />
    <line x1="-80" y1="-25" x2="-80" y2="25" stroke="#d97706" stroke-width="1.2" />
    <text x="25" y="-4" class="dstore-title">D2: Ingested Sources</text>
    <text x="25" y="12" class="dstore-sub">emails &amp; calendar_events</text>
  </g>

  <!-- D3: Structured Responsibilities -->
  <g transform="translate(640, 680)">
    <rect x="-105" y="-25" width="210" height="50" class="dstore-box" />
    <line x1="-80" y1="-25" x2="-80" y2="25" stroke="#d97706" stroke-width="1.2" />
    <text x="25" y="-4" class="dstore-title">D3: Responsibilities</text>
    <text x="25" y="12" class="dstore-sub">Tasks, Actions, Urgencies</text>
  </g>

  <!-- D4: Notifications & Reminders -->
  <g transform="translate(420, 850)">
    <rect x="-105" y="-25" width="210" height="50" class="dstore-box" />
    <line x1="-80" y1="-25" x2="-80" y2="25" stroke="#d97706" stroke-width="1.2" />
    <text x="25" y="-4" class="dstore-title">D4: Notifications</text>
    <text x="25" y="12" class="dstore-sub">24h/48h Alerts, Read States</text>
  </g>

  <!-- D5: Sync State & Logs -->
  <g transform="translate(980, 270)">
    <rect x="-75" y="-25" width="150" height="50" class="dstore-box" />
    <line x1="-55" y1="-25" x2="-55" y2="25" stroke="#d97706" stroke-width="1.2" />
    <text x="18" y="-4" class="dstore-title">D5: Sync State</text>
    <text x="18" y="12" class="dstore-sub">Timestamps &amp; Status</text>
  </g>

  <!-- Directed Data Flows -->
  <!-- User to P1 -->
  <path d="M 120 440 C 140 330, 180 290, 200 280" class="line" marker-end="url(#darr)" />
  <text x="135" y="375" class="df-txt">Sign-in</text>

  <!-- P1 to OAuth -->
  <path d="M 230 215 L 205 155" class="line-sec" marker-end="url(#darr-sec)" />
  <!-- OAuth to P1 -->
  <path d="M 215 155 L 245 212" class="line-sec" marker-end="url(#darr-sec)" />

  <!-- P1 to D1 -->
  <path d="M 260 330 L 260 455" class="line" marker-end="url(#darr)" />
  <text x="268" y="390" class="df-txt">Store Tokens &amp; User</text>

  <!-- P1 to User (JWT) -->
  <path d="M 205 295 C 160 320, 125 380, 110 435" class="line" marker-end="url(#darr)" />
  <text x="110" y="335" class="df-txt">JWT Session</text>

  <!-- D1 to P2 -->
  <path d="M 355 470 C 500 460, 650 340, 680 315" class="line" marker-end="url(#darr)" />
  <text x="490" y="420" class="df-txt">OAuth Credentials</text>

  <!-- Gmail to P2 -->
  <path d="M 610 155 C 640 180, 670 210, 690 225" class="line-sec" marker-end="url(#darr-sec)" />
  <text x="655" y="180" class="df-txt">Emails</text>

  <!-- Calendar to P2 -->
  <path d="M 830 155 C 800 180, 770 210, 750 225" class="line-sec" marker-end="url(#darr-sec)" />
  <text x="795" y="180" class="df-txt">Events</text>

  <!-- P2 to D2 -->
  <path d="M 720 330 L 720 455" class="line" marker-end="url(#darr)" />
  <text x="726" y="390" class="df-txt">Raw Emails &amp; Events</text>

  <!-- P2 to D5 -->
  <path d="M 780 270 L 905 270" class="line" marker-end="url(#darr)" />
  <text x="800" y="262" class="df-txt">Update Sync Log</text>

  <!-- D2 to P3 -->
  <path d="M 825 480 L 978 480" class="line" marker-end="url(#darr)" />
  <text x="850" y="472" class="df-txt">Raw Messages / Context</text>

  <!-- P3 to Gemini LLM -->
  <path d="M 1102 470 L 1175 470" class="line-sec" marker-end="url(#darr-sec)" />
  <text x="1108" y="462" class="df-txt">Prompt + Schema</text>

  <!-- Gemini to P3 -->
  <path d="M 1175 495 L 1102 495" class="line-sec" marker-end="url(#darr-sec)" />
  <text x="1108" y="512" class="df-txt">Structured Output</text>

  <!-- P3 to D3 -->
  <path d="M 1010 535 C 960 610, 800 665, 745 675" class="line" marker-end="url(#darr)" />
  <text x="860" y="620" class="df-txt">Validated Tasks &amp; Discoveries</text>

  <!-- D3 to P4 -->
  <path d="M 535 680 L 482 680" class="line" marker-end="url(#darr)" />
  <text x="488" y="672" class="df-txt">Active Deadlines</text>

  <!-- D2 to P4 -->
  <path d="M 660 505 C 570 540, 480 600, 450 625" class="line" marker-end="url(#darr)" />
  <text x="525" y="565" class="df-txt">Calendar Times</text>

  <!-- P4 to D4 -->
  <path d="M 420 742 L 420 825" class="line" marker-end="url(#darr)" />
  <text x="426" y="785" class="df-txt">24h / 48h Alerts</text>

  <!-- P4 to User (Dashboard feed) -->
  <path d="M 360 690 C 240 700, 110 630, 90 525" class="line" marker-end="url(#darr)" />
  <text x="140" y="650" class="df-txt">Intelligence Dashboard &amp; Alerts</text>

  <!-- User to P5 (Queries) -->
  <path d="M 110 525 C 160 640, 450 780, 810 710" class="line" marker-end="url(#darr)" />
  <text x="320" y="750" class="df-txt">Ask Question / Search Keyword</text>

  <!-- D2 to P5 -->
  <path d="M 760 505 C 800 550, 840 600, 855 625" class="line" marker-end="url(#darr)" />
  <text x="805" y="565" class="df-txt">Emails &amp; Events</text>

  <!-- D3 to P5 -->
  <path d="M 745 685 L 798 685" class="line" marker-end="url(#darr)" />
  <text x="750" y="677" class="df-txt">Responsibilities</text>

  <!-- D4 to P5 -->
  <path d="M 525 850 C 700 850, 840 790, 855 742" class="line" marker-end="url(#darr)" />
  <text x="640" y="840" class="df-txt">Reminders</text>

  <!-- P5 to Gemini LLM -->
  <path d="M 915 655 C 1000 600, 1150 540, 1185 510" class="line-sec" marker-end="url(#darr-sec)" />
  <text x="1020" y="580" class="df-txt">Contextual RAG Query</text>

  <!-- Gemini to P5 -->
  <path d="M 1205 525 C 1170 590, 1020 660, 922 680" class="line-sec" marker-end="url(#darr-sec)" />
  <text x="1050" y="640" class="df-txt">Answer Synthesis</text>

  <!-- P5 to User -->
  <path d="M 830 735 C 720 820, 240 820, 95 530" class="line" marker-end="url(#darr)" />
  <text x="460" y="805" class="df-txt">Synthesized Answer &amp; Citations</text>

</svg>
`;

// Save all sources
fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-01-overall-use-case.puml'), overallUseCasePUML, 'utf8');
fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-01-overall-use-case.mmd'), overallUseCaseMMD, 'utf8');
fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-01-overall-use-case.svg'), overallUseCaseSVG, 'utf8');

fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-02-detailed-use-case.puml'), detailedUseCasePUML, 'utf8');
fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-02-detailed-use-case.mmd'), detailedUseCaseMMD, 'utf8');
fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-02-detailed-use-case.svg'), detailedUseCaseSVG, 'utf8');

fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-03-system-architecture.puml'), architecturePUML, 'utf8');
fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-03-system-architecture.mmd'), architectureMMD, 'utf8');
fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-03-system-architecture.svg'), architectureSVG, 'utf8');

fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-04-dfd-level-0.puml'), dfdLevel0PUML, 'utf8');
fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-04-dfd-level-0.mmd'), dfdLevel0MMD, 'utf8');
fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-04-dfd-level-0.svg'), dfdLevel0SVG, 'utf8');

fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-05-dfd-level-1.puml'), dfdLevel1PUML, 'utf8');
fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-05-dfd-level-1.mmd'), dfdLevel1MMD, 'utf8');
fs.writeFileSync(path.join(SOURCES_DIR, 'diagram-05-dfd-level-1.svg'), dfdLevel1SVG, 'utf8');

console.log('All source diagram files (.puml, .mmd, .svg) saved to sources/ directory.');

// Render each SVG to 300 DPI high-resolution PNG using Puppeteer
async function renderAllPNGs() {
  console.log('Rendering high-resolution PNGs via headless Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });

  const diagrams = [
    { name: 'diagram-01-overall-use-case', width: 1200, height: 850 },
    { name: 'diagram-02-detailed-use-case', width: 1350, height: 920 },
    { name: 'diagram-03-system-architecture', width: 1350, height: 960 },
    { name: 'diagram-04-dfd-level-0', width: 1200, height: 850 },
    { name: 'diagram-05-dfd-level-1', width: 1350, height: 960 }
  ];

  for (const d of diagrams) {
    const page = await browser.newPage();
    // 2x scale factor gives razor-sharp 300 DPI quality for A4 academic prints
    await page.setViewport({ width: d.width, height: d.height, deviceScaleFactor: 2 });
    const svgPath = path.join(SOURCES_DIR, `${d.name}.svg`);
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    
    // Wrap in standard HTML with no margins
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #ffffff; width: ${d.width}px; height: ${d.height}px; overflow: hidden; }
    svg { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;

    await page.setContent(htmlContent, { waitUntil: 'load' });
    const outPngPath = path.join(REPORT_DIR, `${d.name}.png`);
    await page.screenshot({ path: outPngPath, type: 'png' });
    console.log(`✓ Rendered ${d.name}.png (${d.width * 2}x${d.height * 2} px)`);
    await page.close();
  }

  await browser.close();
  console.log('All 5 diagrams successfully rendered to high-resolution PNG!');
}

renderAllPNGs().catch(err => {
  console.error('Diagram rendering error:', err);
});
