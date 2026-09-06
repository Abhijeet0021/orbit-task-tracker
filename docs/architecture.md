# Architecture Document — Orbit Project & Task Tracking

## 1. High-Level Architecture & Moving Pieces

Orbit is built as a clean, decoupled full-stack application consisting of a Node.js REST API backend and a single-page React frontend:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
│  React 19 SPA + Vite + Tailwind CSS + Recharts + Kanban DND │
│  (Route-level code splitting: 24.9 kB initial entry payload)│
└──────────────────────────────┬──────────────────────────────┘
                               │ JSON REST API / JWT Bearer
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Server Layer                           │
│  Express + Node.js + RBAC & Lifecycle State Middleware      │
│  Controllers: Auth, Projects, Tasks, Bulk/CSV, Dashboard    │
│  Connection Pool (maxPoolSize: 10, minPoolSize: 2)          │
└──────────────────────────────┬──────────────────────────────┘
                               │ Mongoose ODM / High-Throughput .lean()
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Persistence Layer                       │
│  MongoDB Atlas Cluster / Cloud Mongoose                     │
│  Collections: users, projects, tasks, taskactivities,       │
│  alertdismissals (Compound Indexes & Native Timestamps)     │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown
1. **Frontend (Browser SPA)**:
   - **Framework**: React 19, Vite 6, React Router v6.
   - **Performance**: Route-based `React.lazy()` with `<Suspense>` and Rollup manual chunking (`vendor-react`, `vendor-charts`, `vendor-dnd`, `vendor-icons`).
   - **State & Context**: `AuthContext` (JWT lifecycle, user state, 1-click persona switching, 60s cold-start timeout tolerance) and `AlertContext` (overdue badges, real-time sync).
   - **Visualizations**: Recharts for 8-week historical completion velocity charts; `@hello-pangea/dnd` for the interactive drag-and-drop Kanban board.

2. **Backend (Node.js REST API)**:
   - **Framework**: Express with modern ES modules running on Node.js.
   - **Authentication & RBAC**: Non-blocking `await bcrypt.compare()` with JWT tokens (`authenticate`, `requireManager`, `hasProjectAccess`).
   - **Lifecycle & Constraint Engine (`TaskLifecycleService`)**: Enforces state machine transitions (`BACKLOG` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `IN_REVIEW` $\rightarrow$ `DONE` / `BLOCKED`), blocker dependencies in the same project, DFS cycle detection, and unblocking rules.
   - **Immutable Audit Service (`AuditService`)**: Write-only ledger logging creation, field diffs (old vs new values), assignments, blocker relations, and comments.
   - **Analytics Engine (`DashboardController`)**: High-performance MongoDB aggregations (`$facet`, `$unwind` + `$group`) consolidating 40+ sequential operations into 2 parallel pipelines.

3. **Database (MongoDB Atlas / Mongoose)**:
   - Managed MongoDB Atlas cluster connected via Mongoose with pooling (`maxPoolSize: 10`, `minPoolSize: 2`, `serverSelectionTimeoutMS: 5000`, `socketTimeoutMS: 45000`).
   - Targeted compound indexes on `{ project: 1, status: 1 }`, `{ assignees: 1, status: 1 }`, `{ status: 1, due_date: 1 }`, and `{ task: 1, created_at: 1 }`.

---

## 2. Request Path: Representative Action End-to-End

**Action**: A user attempts to transition a task from `IN_REVIEW` to `DONE` via the Task Detail Modal.

1. **Client Interaction**:
   - The user clicks the **"Complete Task"** button on task `ALP-4`.
   - The React client sends a `PUT /api/tasks/6a97...` request with JSON payload `{ "status": "DONE" }` and header `Authorization: Bearer <jwt_token>`.

2. **Server Auth & RBAC Middleware**:
   - `authenticate`: Decodes the JWT, fetches the user with `.lean()`, attaches `req.user` to the request.
   - `hasProjectAccess`: Validates that the user has access to `ALP-4`'s project (`ALP`). (Managers have full portfolio access; regular members must exist in `project.members`).

3. **Lifecycle & Dependency Engine Validation**:
   - `TaskLifecycleService.validateTransition(task, 'DONE')`:
     - Checks if `task.status === 'IN_REVIEW'` (allowed path).
     - Queries `task.blockers` to verify whether any unfinished blocking tasks exist (`status != 'DONE'`).
     - *If an unfinished blocker exists (e.g., `ALP-3` is still `IN_PROGRESS`)*: The engine halts and returns `{ valid: false, error: "Cannot move to Done: task is blocked by unfinished task(s): ALP-3 (Provision Kubernetes Staging Cluster)" }`. The controller responds with `HTTP 400 Bad Request`.
     - *If all blockers are `DONE`*: The engine returns `{ valid: true }`.

4. **Transactional Update & Audit Logging**:
   - The task document is updated: `status = 'DONE'`, `previous_status = null`. Native timestamps update `updated_at`.
   - `AuditService.logActivity`: Inserts an immutable document into `TaskActivity` recording `activity_type = 'STATUS_CHANGED'`, `old_value = 'IN_REVIEW'`, `new_value = 'DONE'`, `user_id = req.user.id`.

5. **Client UI Re-render**:
   - The server responds with `HTTP 200 OK` and the updated task payload.
   - The client modal re-renders the task badge to `Done`, updates the legal transition buttons, appends the new event to the timeline stream, and notifies the dashboard/alert contexts.

---

## 3. What Was Decided Not to Build (And Why)

1. **Client-Side Pagination / Filtering (Deliberately Rejected)**:
   - *Requirement 6*: "All of this must be done by the server — do not load every task into the browser and filter there."
   - *Decision*: We built parametric MongoDB queries with `$or` text regexes, dynamic sorting, and `.skip() / .limit()` pagination. Client-side caching of all tasks was deliberately omitted to maintain high performance and low browser memory footprint.

2. **Mutable Comments or Audit Log Deletion**:
   - *Requirement 9*: "Nothing in the timeline can be edited or deleted after the fact, including by managers."
   - *Decision*: We deliberately built no `UPDATE` or `DELETE` endpoints for `task_activities`. Once recorded, activity history is immutable.

3. **Synchronous Password Hashing & Demo Backdoors**:
   - Synchronous bcrypt blocks the Node.js event loop during peak concurrency. We enforce non-blocking `await bcrypt.compare()` across all authentications and eliminated all bypass passwords.
