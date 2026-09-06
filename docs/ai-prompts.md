# AI Prompts & Workflow Log — Orbit

This document records the prompts used, in chronological order, grouped by development milestone, including issues encountered and corrections made.

---

## 1. Domain Modeling & Architecture

### Prompt 1.1: Schema and RBAC Architecture Design
> **Goal:** Design a robust database schema supporting 2 roles (Manager, Member), project scoping, task blockers within projects, immutable activity history, and alert dismissals with resurrection.
> 
> **Outcome:** Generated clean relational SQLite schema with foreign key cascades, check constraints for enums (`TaskStatus`, `TaskPriority`, `UserRole`), and composite primary keys on junction tables.

### Prompt 1.2: Strict Lifecycle State Machine & Blocker Validation
> **Goal:** Implement `TaskLifecycleService` enforcing legal transitions (`BACKLOG` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `IN_REVIEW` $\rightarrow$ `DONE`, `BLOCKED` $\leftrightarrow$ `previous_status`, and reopening from `DONE`), rejecting illegal moves with descriptive error messages, and checking that a task cannot move to `DONE` if any blocker in the project is unfinished.
> 
> **Outcome:** Produced clean TypeScript service with `validateTransition`, `getLegalTransitions`, `getUnfinishedBlockers`, and DFS `wouldCreateCycle` cycle detection.

---

## 2. API Implementation & Dependency Resolution

### Prompt 2.1: Resolving Node 26 Native Addon Compilation
> **Goal:** Address node-gyp build failure when installing `better-sqlite3` on Node.js 26.5.0 due to V8 `PropertyCallbackInfo::This()` deprecations.
> 
> **Issue Identified:** `better-sqlite3` failed to compile against Node 26's newer V8 engine headers.
> 
> **Correction Made:** Prompted migration to Node.js 26's built-in `node:sqlite` standard library (`DatabaseSync`). This removed the native build dependency entirely while providing full synchronous SQLite capabilities and WAL performance.

### Prompt 2.2: Server-Side Search, Filter, & Pagination Controller
> **Goal:** Create `GET /api/tasks` endpoint with parametric SQL filtering (project, status, assignee, priority, overdue), search on title/description, multi-field sorting, and total count pagination.
> 
> **Outcome:** Delivered parameterized SQL query builder ensuring server-side execution without loading entire datasets into browser memory.

### Prompt 2.3: Atomic Bulk Actions & CSV Exporter
> **Goal:** Implement `POST /api/tasks/bulk` and `GET /api/tasks/export.csv`. Bulk actions must evaluate each task independently and return an execution report detailing per-task successes and rejections with specific reasons.
> 
> **Outcome:** Implemented per-item evaluation loop with isolated error handling returning `{ summary, results }` JSON payloads, plus streaming CSV generation with proper character escaping.

---

## 3. Automated Test Suite

### Prompt 3.1: Comprehensive Unit & Integration Tests
> **Goal:** Write a complete `vitest` suite testing RBAC restrictions, state transitions, blocker constraints, member removal auto-unassignment, bulk partial failures, and alert resurfacing.
> 
> **Issue Encountered:** Vitest initially failed several tests with `no such column: "MANAGER"` because double quotes were used in raw SQL test queries (`WHERE role = "MANAGER"`), which SQLite parses as column identifiers.
> 
> **Correction Made:** Updated all test queries to use single quotes (`WHERE role = 'MANAGER'`). All 14 test cases passed successfully.

---

## 4. Frontend UI & Interactive Components

### Prompt 4.1: Executive Dashboard & 8-Week Velocity Visualizations
> **Goal:** Build an executive dashboard in React with 4 KPI summary cards, Recharts 8-week completion bar chart, status breakdown progress bars, and team workload allocation cards.
> 
> **Outcome:** Clean, responsive dashboard layout matching modern design aesthetics.

### Prompt 4.2: Task Detail Modal with Dynamic Transitions & Immutable Audit Stream
> **Goal:** Create a modal that dynamically queries legal transition buttons, explains disabled moves, manages project member assignees and blockers, and renders the chronological immutable audit stream with comment submission.
> 
> **Outcome:** Fully functional task modal with live audit trail, blocker badges, and manager delete controls.
