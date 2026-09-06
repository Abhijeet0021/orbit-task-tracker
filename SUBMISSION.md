# Assignment 01 — Project & Task Tracking System Submission

## Project Overview

**Orbit** is a full-stack internal project and task tracking application designed for multi-project client service companies. It enforces server-side role-based access control (RBAC), strict state machine lifecycle transitions, dependency blocker graphs with cycle detection, dynamic assignment scoping, server-side search and pagination, atomic bulk operations with per-item reporting, high-throughput aggregated dashboard analytics, immutable audit trails, and intelligent overdue alert resurfacing.

---

## 🌐 Live Cloud Deployments & Repository

| Service | URL | Notes |
|---|---|---|
| **Frontend Web App (Netlify)** | [https://orbit-task-tracker.netlify.app](https://orbit-task-tracker.netlify.app) | React 19 + Vite 6 (Code-split: 24.9 kB entry payload) |
| **Backend API (Render)** | [https://orbit-task-tracker-api.onrender.com](https://orbit-task-tracker-api.onrender.com) | Node.js + Express + Mongoose |
| **API Health Check** | [https://orbit-task-tracker-api.onrender.com/api/health](https://orbit-task-tracker-api.onrender.com/api/health) | Zero-overhead uptime & connection probe |
| **GitHub Repository** | [https://github.com/Abhijeet0021/orbit-task-tracker](https://github.com/Abhijeet0021/orbit-task-tracker) | Clean commit history, zero secrets |
| **Database** | MongoDB Atlas Cluster | `cluster0.hkarmjo.mongodb.net / task_tracker` |

---

## 🔑 Demo Personas & Credentials

All seeded users use the password **`password123`**:

| Persona / Role | Email | Password | Scope & Permissions |
|---|---|---|---|
| **Sarah Connor (Manager)** | `manager@acme.com` | `password123` | Full portfolio access, create/archive projects, add/remove members, delete tasks |
| **Alex Rivera (Member)** | `member1@acme.com` | `password123` | Assigned to Alpha Platform, Billing Engine, Legacy Migration |
| **Devon Vance (Member)** | `member2@acme.com` | `password123` | Assigned to Alpha Platform, Mobile Companion App |
| **Elena Rostova (Member)** | `member3@acme.com` | `password123` | Assigned to Billing Engine, Mobile Companion App |

> **Tip:** The application includes an **Instant Demo Persona Switcher** on the login page and navigation bar, allowing reviewers to switch between roles with a single click to verify server-side permission enforcement and scoping instantly.

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- Node.js (v20+ or v22+ or v24+)
- npm (v10+)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Abhijeet0021/orbit-task-tracker.git
cd orbit-task-tracker
npm install
```

### 2. Run Automated Test Suite
```bash
npm test
```
*Runs all 14 integration and unit test suites across RBAC, lifecycle rules, blockers, bulk operations, and alert dismissals in ~2s via in-memory MongoDB.*

### 3. Start Full-Stack Application
```bash
# Development mode (runs server on :5001 and Vite client on :5173 concurrently)
npm run dev

# Or build for production
npm run build
npm run dev:server
```
Open **`http://localhost:5173`** (or `http://localhost:5001` in production build).

---

## 📋 Core Requirements Verification Matrix

| # | Requirement | Status | Server-Side Enforcement & Implementation Notes |
|---|---|---|---|
| **1** | **Accounts and Roles** | ✅ Complete | JWT + asynchronous `bcrypt.compare` authentication. `MANAGER` can create/archive projects, manage members, delete tasks. `MEMBER` is restricted to assigned projects and cannot delete tasks or archive projects. |
| **2** | **Projects** | ✅ Complete | Unique alphanumeric key (2-8 chars), name, description, owner. Archiving hides projects from default views without data loss. Restoring re-activates projects. |
| **3** | **Tasks inside Projects** | ✅ Complete | Monotonic sequential numbering (`ALP-101`), priority, due date, blocker links within the same project. |
| **4** | **Task Lifecycle with Rules** | ✅ Complete | Strict state machine: `BACKLOG` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `IN_REVIEW` $\rightarrow$ `DONE`. `BLOCKED` status saves `previous_status` and restores it upon unblocking. Moving to `DONE` is rejected if unfinished blockers exist. Illegal transitions return 400. |
| **5** | **Assignment & Scoping** | ✅ Complete | Multi-assignee support. Removing a member from a project automatically unassigns them from all project tasks and logs audit events. Non-managers only see tasks from assigned projects. |
| **6** | **Search & Pagination** | ✅ Complete | Server-side text search (title + description), multi-criteria filters (project, status, assignee, priority, overdue), sort, and pagination with total counts and bounded limits (max 100). |
| **7** | **Bulk Actions & CSV Export** | ✅ Complete | Multi-task batch actions (status, assignee, due date, priority) with per-item success/failure reporting without failing the batch. Clean CSV streaming export (`/api/tasks/export.csv`). |
| **8** | **Executive Dashboard** | ✅ Complete | High-performance MongoDB aggregations (`$facet`, `$unwind` + `$group`) computing headline metrics, status breakdown, assignee workload cards, and 8-week completion velocity chart. |
| **9** | **Immutable Audit History** | ✅ Complete | Every creation, field update (old vs new), status transition, assignment, blocker, and user comment logged chronologically in `task_activities`. No edit/delete capabilities exist. |
| **10** | **Overdue Alerts & Resurfacing** | ✅ Complete | Dynamic SLA calculation (`days_overdue`). Assignees can dismiss alerts. Changing a task's due date to a new overdue date automatically resurfaces the alert. |

---

## ⚡ Performance & Production Hardening Highlights

1. **Frontend Bundle Reduction (96.7% Drop)**: Monolithic 768 kB bundle reduced to **24.9 kB** using route-based `React.lazy()` and Vite `manualChunks`.
2. **Dashboard Query Consolidation**: Reduced from **40+ sequential operations** down to **2 parallel MongoDB aggregations**.
3. **N+1 Query Elimination**: Converted per-project task count loops into a single `$group` aggregation.
4. **Mongoose `.lean()` Acceleration**: Applied across all read endpoints for zero document hydration overhead.
5. **Database Indexing**: Compound indexes on `{ project: 1, status: 1 }`, `{ assignees: 1, status: 1 }`, `{ status: 1, due_date: 1 }`, and `{ task: 1, created_at: 1 }`.
6. **Server Startup Resilience**: Server awaits MongoDB connection before accepting incoming traffic; configured connection pooling (`maxPoolSize: 10`).
7. **Cold-Start Tolerance**: 60-second timeout guard with animated loading indicator and session reset escape hatch.

---

## ✨ Included Stretch Features

1. **Interactive Drag-and-Drop Kanban Board** (`@hello-pangea/dnd`) with client & server-side legal transition guards.
2. **Blocker Dependency Cycle Detection**: Graph DFS traversal prevents circular dependency chains ($A \rightarrow B \rightarrow A$).
3. **Instant Demo Persona Switcher**: 1-click role testing in navigation and login page.
4. **Command Palette (`Cmd + K`)**: Quick keyboard navigation across tasks, projects, and actions.
5. **Tailwind CSS UI**: Fully responsive with polished status badges and Lucide iconography.

---

## 📁 Required Documentation Files

- [`architecture.md`](architecture.md) — System architecture, request flows, component boundaries, and rejected designs.
- [`schema.md`](schema.md) — Schema definitions, indexes, constraints, denormalizations, and 100x scaling plan.
- [`plan.md`](plan.md) — Build order, time breakdown, estimated vs actuals, and scope management.
- [`decisions.md`](decisions.md) — 5 technical architecture decisions including 1 reversed decision with rationale.
- [`ai-prompts.md`](ai-prompts.md) — Prompts used, debugging logs, and AI pair programming reflections.
