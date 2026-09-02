# 🪐 Orbit — Project & Task Management Platform

A full-stack, production-ready Project & Task Tracking platform built with **React (Vite + Tailwind)**, **Node.js Express**, and **MongoDB (Mongoose)**, ready for instant cloud deployment on **Render** (Backend) and **Netlify** (Frontend).

---

## 🗂️ Project Architecture & Directory Map

The codebase maintains a strict separation of concerns between **Frontend (`client/`)** and **Backend (`server/`)**:

```
task-tracker/
│
├── 🌐 client/                     # FRONTEND (React 18 + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── api/                   # API client configured with VITE_API_URL
│   │   ├── context/               # Auth, Alerts, and Toast state providers
│   │   ├── pages/                 # Full screen views (Dashboard, Tasks, Kanban, etc.)
│   │   ├── components/            # UI components (Kanban board, Stepper, Badges, Modals)
│   │   ├── App.jsx                # Router & protected route wrappers
│   │   └── main.jsx               # React DOM mount
│   ├── vite.config.js             # Vite bundler config with /api proxy to :5001
│   ├── tailwind.config.js         # Design tokens & theme colors
│   └── README.md                  # Detailed frontend documentation
│
├── ⚙️ server/                     # BACKEND (Node.js Express + MongoDB / Mongoose)
│   ├── src/
│   │   ├── config/                # Database connection (database.js)
│   │   ├── models/                # Mongoose models (User, Project, Task, TaskActivity, AlertDismissal)
│   │   ├── controllers/           # REST handlers (Tasks, Projects, Auth, Bulk, Alerts, Dashboard)
│   │   ├── middleware/            # JWT authentication & RBAC authorization
│   │   ├── routes/                # REST API route mappings (/api/*)
│   │   ├── seed/                  # Demo database seeder (seedData.js)
│   │   ├── services/              # Finite State Machine & Immutable audit logger
│   │   └── index.js               # Express API entry with /api/health endpoint
│   ├── tests/
│   │   └── taskTracker.test.js    # 14 automated integration tests (Vitest + MongoMemoryServer)
│   └── README.md                  # Detailed backend documentation
│
├── netlify.toml                   # Netlify build configuration & SPA redirects
├── render.yaml                    # Render Web Service blueprint configuration
├── package.json                   # Root orchestrator scripts (dev, test, seed, build)
├── vitest.config.js               # Vitest runner configuration
├── .env.example                   # Environment variable template
└── README.md                      # Project documentation & deployment guide
```

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Test Suite
Runs all 14 integration test suites using an in-memory MongoDB instance (requires 0 external setup):
```bash
npm test
```

### 3. Start Frontend & Backend Concurrently
```bash
npm run dev
```
* **Frontend**: [http://localhost:5173](http://localhost:5173)
* **Backend API**: [http://localhost:5001](http://localhost:5001)
* **Health Check**: [http://localhost:5001/api/health](http://localhost:5001/api/health)

---

## ☁️ Cloud Deployment Guide

### Part 1: Set Up MongoDB Atlas (Database)

1. Go to **[mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)** and log in or sign up.
2. Create a **Free Shared Cluster (M0)**.
3. Under **Security > Database Access**:
   - Create a database user (e.g. `orbit_admin` and set a secure password).
4. Under **Security > Network Access**:
   - Add IP Address: `0.0.0.0/0` (Allow access from anywhere, required for Render).
5. Click **Connect > Drivers**:
   - Copy the connection string:
     ```
     mongodb+srv://orbit_admin:<password>@cluster0.xxxxx.mongodb.net/task_tracker?retryWrites=true&w=majority
     ```

---

### Part 2: Deploy Backend to Render

1. Push your repository to **GitHub**.
2. Go to **[render.com](https://render.com)** and sign in.
3. Click **New + > Web Service** and connect your GitHub repository.
4. Fill in the service configuration:
   - **Name**: `orbit-task-tracker-api` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server/src/index.js`
   - **Health Check Path**: `/api/health`
5. In **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `PORT`: `5001`
   - `JWT_SECRET`: *(A random 32-character secret string)*
   - `MONGODB_URI`: *(Your MongoDB Atlas connection URI from Part 1)*
   - `CORS_ORIGIN`: `https://<your-netlify-site>.netlify.app` *(update once Netlify is created)*
6. Click **Create Web Service**.
7. Once deployed, note your Render backend URL (e.g., `https://orbit-task-tracker-api.onrender.com`).

*(Optional: To seed your production MongoDB with initial demo data, run `MONGODB_URI="<your-atlas-uri>" npm run seed` from your local machine)*

---

### Part 3: Deploy Frontend to Netlify

1. Go to **[netlify.com](https://www.netlify.com)** and sign in.
2. Click **Add new site > Import an existing project** and select your GitHub repository.
3. Fill in the build settings:
   - **Base directory**: *(leave empty)*
   - **Build command**: `npm run build`
   - **Publish directory**: `dist/client`
4. In **Site configuration > Environment variables**, add:
   - `VITE_API_URL`: `https://orbit-task-tracker-api.onrender.com/api` *(Your Render backend URL with /api)*
5. Click **Deploy Site**.
6. Copy your Netlify site URL (e.g., `https://orbit-tasks.netlify.app`) and update the `CORS_ORIGIN` variable in Render!

---

## 👥 Demo Personas (Available for 1-Click Login)

| Persona Name | Email | Role | Accessible Scope |
| :--- | :--- | :--- | :--- |
| **Sarah Connor** | `manager@acme.com` | `MANAGER` | Full portfolio, project archiving, task deletion, member admin |
| **Alex Rivera** | `member1@acme.com` | `MEMBER` | Member of Alpha, Billing, Legacy projects |
| **Devon Vance** | `member2@acme.com` | `MEMBER` | Member of Alpha, Mobile projects |
| **Elena Rostova** | `member3@acme.com` | `MEMBER` | Member of Billing, Mobile projects |

*Default password for all demo accounts*: `password123`.

---

## 🛡️ Core Rules Enforced Server-Side

1. **Role-Based Access Control (RBAC)**:
   - Only `MANAGER` can delete tasks, create/archive projects, and manage project members.
   - Removing a member from a project automatically unassigns them from all tasks in that project.
2. **Strict Task State Machine**:
   - Legal flow: `BACKLOG` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `IN_REVIEW` $\rightarrow$ `DONE`.
   - Direct jumps (e.g. `BACKLOG` $\rightarrow$ `DONE`) are rejected with 400 Bad Request.
   - Tasks cannot be marked `DONE` if any blocking dependency is unfinished.
   - Blocker cycle detection prevents circular dependencies ($A \rightarrow B \rightarrow A$).
   - `BLOCKED` state preserves and restores `previous_status` upon unblocking.
3. **Immutable Audit Trail**:
   - All state changes, assignments, blocker additions/removals, and comments are append-only.
