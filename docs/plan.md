# Development Plan & Build Order — Orbit

## 1. Work Split & Build Order

We structured the build into focused, incremental phases. Building from foundational domain rules upwards ensured that state machines and authorization constraints were guaranteed before UI rendering began:

### Session 1: Domain Modeling & Server-Side Security (Core)
- Established schema with foreign key constraints, indexes, and write-ahead logging.
- Created `authenticate`, `requireManager`, and `requireProjectAccess` middleware.
- Implemented `TaskLifecycleService` with strict state transitions, blocker checks, cycle detection, and unblocking rules.
- Implemented `AuditService` for immutable activity logging.

### Session 2: API Endpoints, Bulk Operations, & Search
- Implemented Project Controller with archive/restore and member management (with auto-unassignment on removal).
- Implemented Task Controller with server-side filtering (project, status, assignee, priority, overdue), search, sorting, and pagination.
- Implemented Atomic Bulk Controller (independent per-item evaluation reporting exact successes and failures) and CSV Exporter.
- Implemented Overdue Alerts and Dismissal/Resurfacing Controller.
- Implemented Executive Dashboard KPI aggregation and 8-week completion bucketing.

### Session 3: Automated Testing & Verification
- Built an automated test suite (`vitest`) covering:
  - RBAC permission enforcement (member vs manager).
  - Illegal state transition rejection.
  - Blocker resolution requirements before moving to `DONE`.
  - Auto-unassignment upon project member removal.
  - Partial batch failure reporting in bulk operations.
  - Overdue alert dismissal and resurrection on due date update.
- Seeded realistic client projects, tasks, blocker dependencies, and 8-week sprint completions.

### Session 4: Frontend Development & UI Polish
- Built React client architecture with Tailwind CSS and Lucide icons.
- Built interactive Executive Dashboard with Recharts 8-week velocity bars and assignee workload gauges.
- Built Projects workspace and Project Detail view with member management.
- Built All Tasks view with server-side controls, multi-task selection, floating bulk action bar, and execution report modal.
- Built Task Detail modal with dynamic legal transition buttons and full immutable audit timeline stream with comments.
- Built Drag-and-Drop Kanban Board with legal transition guards.
- Built Overdue Alerts page and navigation notification badge.

### Session 5: Documentation & Packaging
- Completed all 5 required `docs/` documents.
- Prepared `SUBMISSION.md` with credentials, test instructions, and deployment guide.

---

## 2. Estimated vs. Actual Time

| Milestone | Estimated Time | Actual Time | Notes |
|---|---|---|---|
| Domain Schema & Lifecycle Rules Engine | 2.5 hours | 2.0 hours | Using SQLite with `node:sqlite` was fast and eliminated ORM friction. |
| API Endpoints, Bulk Actions & CSV Streaming | 2.5 hours | 2.5 hours | Bulk reporting per-task error tracking took precise error handling. |
| Automated Test Suite & Seed Dataset | 2.0 hours | 1.5 hours | Vitest ran fast and caught SQL single-quote differences. |
| Frontend UI, Kanban Board & Timeline | 3.5 hours | 3.5 hours | Tailwind + Lucide + Recharts allowed clean component composition. |
| Overdue Alerts Resurfacing & Audit Stream | 1.5 hours | 1.5 hours | Alert dismissal logic tested cleanly with due date invalidation. |
| Documentation (`docs/*`, `SUBMISSION.md`) | 1.5 hours | 1.5 hours | Clear architectural notes kept throughout the build. |
| **Total** | **13.5 hours** | **12.5 hours** | Well within the ~12-hour budget. |

---

## 3. What Was Cut or Prioritized

- **Prioritized**:
  - 100% adherence to all 10 core brief requirements.
  - Strict server-side RBAC and lifecycle rejection explanations.
  - Per-item error reporting for bulk batch operations.
  - Automatic unassignment and audit logging when removing project members.
  - Alert dismissal resurrection mechanics on due date updates.
  - Drag-and-drop Kanban board with transition guards.
  - Cycle detection for task blocker graphs.

- **Cut / Deferred**:
  - Complex custom field builder (would add schema flexibility at the cost of core rule simplicity).
  - Real-time WebSocket subscriptions (polled REST API was chosen for simplicity, zero connection drops, and lower hosting resource requirements).
