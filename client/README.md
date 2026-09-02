# 🌐 Client (Frontend Application)

This directory contains the entire **React Single Page Application (SPA)** built with Vite, Tailwind CSS, and Lucide icons.

---

## 📁 Directory Structure

```
client/
├── index.html                 # Main HTML entry template
├── vite.config.js             # Vite configuration with /api proxy to :5001
├── tailwind.config.js         # Tailwind styling tokens
├── postcss.config.js          # PostCSS processor configuration
└── src/
    ├── main.jsx               # React DOM root mounting point
    ├── App.jsx                # Router, auth route protection, and providers
    ├── index.css              # Global styling & Tailwind directives
    │
    ├── api/                   # Server API Communication
    │   └── client.js          # Typed fetch client with auth token headers
    │
    ├── context/               # Global React State Providers
    │   ├── AuthContext.jsx    # Session management & instant persona switching
    │   ├── AlertContext.jsx   # Polls overdue tasks for the active user
    │   └── ToastContext.jsx   # Floating animated toast notifications
    │
    ├── pages/                 # Full Page Route Views
    │   ├── LoginPage.jsx          # Login screen with 1-click persona logins
    │   ├── DashboardPage.jsx      # Executive KPI charts & 8-week velocity bars
    │   ├── ProjectsPage.jsx       # Project list, archiving, and member admin
    │   ├── ProjectDetailPage.jsx  # Kanban board & project settings
    │   ├── TasksListPage.jsx      # Cross-project task table with quick filters & bulk dock
    │   ├── MyTasksPage.jsx        # Work assigned to the active user
    │   └── AlertsPage.jsx         # Overdue SLA alert triage & dismissals
    │
    └── components/            # Reusable UI Components
        ├── common/            # Modals, status badges, priority badges, role tags
        ├── layout/            # Sticky Navbar, Sidebar navigation, and AppLayout shell
        ├── kanban/            # Drag-and-drop Kanban board (@hello-pangea/dnd)
        └── tasks/             # Task detail inspector, visual stepper, and append-only timeline
```

---

## 🚀 Running the Client Independently

From the project root:
```bash
npm run dev:client
```
The client runs on **[http://localhost:5173](http://localhost:5173)** and automatically proxies all `/api/*` requests to the backend on `http://localhost:5001`.
