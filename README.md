# 🪐 Orbit — Project & Task Management Platform

A full-stack, production-grade Project & Task Tracking platform built with a strict separation of concerns between **Frontend (`client/`)** and **Backend (`server/`)**.

---

## 🗂️ Project Architecture & Folder Breakdown

The codebase is organized into dedicated directories so anyone can immediately identify and navigate the frontend, backend, and documentation:

```
task-tracker/
│
├── 🌐 client/                     # FRONTEND (React 18 + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── api/                   # Typed API client calling backend endpoints
│   │   ├── context/               # Auth, Overdue Alerts, and Toast State Providers
│   │   ├── pages/                 # Full screen views (Dashboard, Tasks, Kanban, etc.)
│   │   ├── components/            # UI components (Kanban board, Stepper, Badges, Modals)
│   │   ├── App.jsx                # Router & Protected Route wrapper
│   │   └── main.jsx               # React DOM entry
│   ├── vite.config.js             # Vite bundler config with /api proxy to :5001
│   ├── tailwind.config.js         # Frontend design tokens
│   └── README.md                  # Detailed frontend documentation
│
├── ⚙️ server/                     # BACKEND (Node.js Express + SQLite Engine)
│   ├── src/
│   │   ├── config/                # Database connection & schema tables (database.js)
│   │   ├── controllers/           # HTTP handlers (Tasks, Projects, Auth, Bulk, Alerts)
│   │   ├── middleware/            # JWT authentication & RBAC authorization
│   │   ├── routes/                # REST API route mappings (/api/*)
│   │   ├── seed/                  # Realistic demo data seeder (seedData.js)
│   │   ├── services/              # Finite State Machine & Audit logging logic
│   │   └── index.js               # Express application entry (port 5001)
│   ├── tests/
│   │   └── taskTracker.test.js    # 14 automated integration test suites
│   └── README.md                  # Detailed backend documentation
│
├── task_tracker.sqlite            # SQLite database file (WAL mode enabled)
├── package.json                   # Root orchestrator scripts (dev, test, seed, build)
├── vitest.config.js               # Backend test suite runner config
├── .env.example                   # Environment variable template
└── README.md                      # Project setup & quickstart guide
```

> **Note**: Comprehensive technical design specs, schema diagrams, and submission reports are provided in the companion directory: `task-tracker-docs/` (or `task-tracker-docs.zip`).

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Demo Data
Populates the SQLite database with 4 projects, 4 team personas, and 20+ realistic tasks:
```bash
npm run seed
```

### 3. Run Both Frontend and Backend Concurrently
```bash
npm run dev
```
* **Frontend**: [http://localhost:5173](http://localhost:5173)
* **Backend API**: [http://localhost:5001](http://localhost:5001)

### 4. Run Automated Test Suite
Runs all 14 integration test suites covering RBAC, state machine validation, cycle detection, and batch operations:
```bash
npm test
```

---

## 👥 Demo Personas (Available for 1-Click Login)

| Persona Name | Email | Role | Accessible Scope |
| :--- | :--- | :--- | :--- |
| **Sarah Connor** | `manager@acme.com` | `MANAGER` | Full portfolio, project archiving, task deletion, member admin |
| **Alex Rivera** | `member1@acme.com` | `MEMBER` | Member of Alpha, Billing, Legacy projects |
| **Devon Vance** | `member2@acme.com` | `MEMBER` | Member of Alpha, Mobile projects |
| **Elena Rostova** | `member3@acme.com` | `MEMBER` | Member of Billing, Mobile projects |

*Default password for all demo accounts*: `password123` (or use the instant switcher in the top navigation bar).

---

## 🛡️ Core Rules Enforced Server-Side

1. **Role-Based Access Control (RBAC)**:
   - Only `MANAGER` can delete tasks, create/archive projects, and manage project members.
   - Removing a member from a project automatically unassigns them from all tasks in that project.
2. **Strict Task State Machine**:
   - `BACKLOG` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `IN_REVIEW` $\rightarrow$ `DONE`.
   - Illegal state jumps (e.g. `BACKLOG` $\rightarrow$ `DONE`) are rejected with descriptive 400 error payloads.
   - Tasks cannot be marked `DONE` if any blocking dependency is unfinished.
   - Cycle prevention prevents circular blocker chains ($A \rightarrow B \rightarrow A$).
   - `BLOCKED` state preserves and restores `previous_status` upon unblocking.
3. **Immutable Audit Trail**:
   - Every status change, assignment, blocker, and comment is written to an append-only activity log (edits and deletions forbidden).
