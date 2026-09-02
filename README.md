# 🪐 Orbit — Project & Task Management Platform

A production-grade, full-stack Project & Task Tracking platform built with **React (Vite + Tailwind CSS)**, **Node.js Express**, and **MongoDB (Mongoose)**, engineered with strict role-based access control, finite state machines, blocker cycle prevention, and an append-only audit trail.

---

## 🌐 Live Cloud Deployment

| Component | Provider | Live URL / Status |
| :--- | :--- | :--- |
| **Backend API** | Render Web Service | [https://orbit-task-tracker-api.onrender.com](https://orbit-task-tracker-api.onrender.com) |
| **Health Check** | Render Automated Probe | [https://orbit-task-tracker-api.onrender.com/api/health](https://orbit-task-tracker-api.onrender.com/api/health) |
| **Database** | MongoDB Atlas | Free Shared M0 Cloud Cluster (AWS / Oregon) |
| **Frontend SPA** | Netlify Static Site | Deployed via Netlify CI/CD with SPA redirects |

---

## 🗂️ Project Architecture & Directory Map

The codebase maintains a clean separation of concerns between **Frontend (`client/`)** and **Backend (`server/`)**:

```
task-tracker/
│
├── 🌐 client/                     # FRONTEND (React 18 + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── api/                   # API client dynamically configured with VITE_API_URL
│   │   ├── context/               # Auth, Overdue Alerts, and Toast State Providers
│   │   ├── pages/                 # Full screen views (Dashboard, Tasks, Kanban, Alerts, Projects)
│   │   ├── components/            # UI components (Kanban board, Stepper, Badges, Modals)
│   │   ├── App.jsx                # Router & protected route wrappers
│   │   └── main.jsx               # React DOM entry point
│   ├── vite.config.js             # Vite bundler config with /api proxy to :5001
│   ├── tailwind.config.js         # Design tokens & theme colors
│   └── README.md                  # Detailed frontend documentation
│
├── ⚙️ server/                     # BACKEND (Node.js Express + MongoDB / Mongoose)
│   ├── src/
│   │   ├── config/                # Database connection & URL port sanitization (database.js)
│   │   ├── models/                # Mongoose schemas (User, Project, Task, TaskActivity, AlertDismissal)
│   │   ├── controllers/           # REST handlers (Tasks, Projects, Auth, Bulk, Alerts, Dashboard)
│   │   ├── middleware/            # JWT authentication & RBAC authorization
│   │   ├── routes/                # REST API route mappings (/api/*)
│   │   ├── seed/                  # Demo database seeder (seedData.js)
│   │   ├── services/              # Finite State Machine & Immutable audit logger
│   │   └── index.js               # Express API entry with dynamic CORS & /api/health
│   ├── tests/
│   │   └── taskTracker.test.js    # 14 automated integration tests (Vitest + MongoMemoryServer)
│   └── README.md                  # Detailed backend documentation
│
├── netlify.toml                   # Netlify build pipeline & SPA redirect rules (/* -> /index.html)
├── render.yaml                    # Render Web Service blueprint configuration
├── package.json                   # Monorepo orchestrator scripts (dev, test, seed, build)
├── vitest.config.js               # Vitest runner configuration
├── .env.example                   # Environment variable template
└── README.md                      # Project documentation & deployment guide
```

---

## 👥 Demo Personas (Available for 1-Click Login)

| Persona Name | Email | Role | Accessible Scope | Password |
| :--- | :--- | :--- | :--- | :--- |
| **Sarah Connor** | `manager@acme.com` | `MANAGER` | Full portfolio, project archiving, task deletion, member admin | `password123` *(or `Manager123!`)* |
| **Alex Rivera** | `member1@acme.com` | `MEMBER` | Member of Alpha, Billing, Legacy projects | `password123` *(or `Member123!`)* |
| **Devon Vance** | `member2@acme.com` | `MEMBER` | Member of Alpha, Mobile projects | `password123` *(or `Member123!`)* |
| **Elena Rostova** | `member3@acme.com` | `MEMBER` | Member of Billing, Mobile projects | `password123` *(or `Member123!`)* |

*(Tip: On the login page, click any of the persona cards on the left to sign in with one click).*

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Integration Test Suite
Runs all 14 integration test suites using an in-memory MongoDB instance (requires 0 external setup or running database):
```bash
npm test
```

### 3. Start Frontend & Backend Concurrently
```bash
npm run dev
```
* **Frontend UI**: [http://localhost:5173](http://localhost:5173)
* **Backend API**: [http://localhost:5001](http://localhost:5001)
* **Health Check**: [http://localhost:5001/api/health](http://localhost:5001/api/health)

---

## 🛡️ Core Business Rules Enforced Server-Side

1. **Role-Based Access Control (RBAC)**:
   - Only users with the `MANAGER` role can delete tasks, create/archive projects, and manage project members.
   - Removing a member from a project automatically unassigns them from all tasks in that project.
2. **Strict Task Lifecycle State Machine**:
   - Legal flow: `BACKLOG` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `IN_REVIEW` $\rightarrow$ `DONE`.
   - Direct illegal jumps (e.g. `BACKLOG` $\rightarrow$ `DONE`) are rejected with 400 Bad Request.
   - Tasks cannot be marked `DONE` if any blocking dependency is unfinished.
   - Cycle prevention algorithm (BFS/DFS traversal) rejects circular dependency chains ($A \rightarrow B \rightarrow A$).
   - `BLOCKED` state preserves and restores `previous_status` upon unblocking.
3. **Immutable Audit Trail**:
   - All state transitions, assignments, blocker changes, and comments are append-only. Edits and deletions of history are prevented.
4. **Smart Overdue SLA Alerts**:
   - Users receive real-time alerts for overdue tasks assigned to them.
   - Alerts can be dismissed, but will automatically resurface if the task's due date is rescheduled to a new overdue date.

---

## ☁️ Cloud Deployment Walkthrough

### 1. Database (MongoDB Atlas)
1. Create a free **M0 Cluster** on [MongoDB Atlas](https://cloud.mongodb.com).
2. Under **Database Access**, create a user (e.g., `admin` / `Admin2026`).
3. Under **Network Access**, allow access from anywhere (`0.0.0.0/0`).
4. Copy the connection string:
   ```text
   mongodb+srv://admin:Admin2026@cluster0.xxxxx.mongodb.net/task_tracker?retryWrites=true&w=majority
   ```

### 2. Backend (Render)
1. Create a new **Web Service** on [Render](https://render.com) connected to your GitHub repo.
2. Configure settings:
   - **Build Command**: `npm install`
   - **Start Command**: `node server/src/index.js`
   - **Health Check Path**: `/api/health`
3. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `5001`
   - `JWT_SECRET`: `orbit-super-secret-jwt-key-2026`
   - `MONGODB_URI`: `mongodb+srv://admin:Admin2026@cluster0.xxxxx.mongodb.net/task_tracker?retryWrites=true&w=majority`
   - `CORS_ORIGIN`: `*` *(or your Netlify URL)*

### 3. Frontend (Netlify)
1. Create a new site on [Netlify](https://netlify.com) from your GitHub repository.
2. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist/client`
3. Set Environment Variable:
   - `VITE_API_URL`: `https://orbit-task-tracker-api.onrender.com/api`
