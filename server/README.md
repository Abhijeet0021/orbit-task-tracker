# ⚙️ Server (Backend Application & Database Engine)

This directory contains the **Node.js Express REST API**, powered by the Node.js standard library `node:sqlite` database engine with foreign keys and WAL mode.

---

## 📁 Directory Structure

```
server/
├── tests/
│   └── taskTracker.test.js    # 14/14 Automated integration tests (Vitest)
│
└── src/
    ├── index.js               # Express application entry point (port 5001)
    │
    ├── config/
    │   └── database.js        # SQLite connection, schema definition & migrations
    │
    ├── middleware/
    │   └── auth.js            # JWT verification, RBAC (requireManager, requireProjectAccess)
    │
    ├── services/
    │   ├── taskLifecycle.js   # Finite State Machine & blocker dependency cycle validator
    │   └── auditService.js    # Immutable append-only activity & comment audit ledger
    │
    ├── controllers/
    │   ├── authController.js       # Login & /api/auth/me persona session
    │   ├── projectController.js    # Projects CRUD, archiving & member management
    │   ├── taskController.js       # Tasks CRUD, assignees, blockers & comments
    │   ├── bulkController.js       # Atomic per-task batch updates with error reporting
    │   ├── dashboardController.js  # KPI aggregation & 8-week completion cadence
    │   └── alertController.js      # Overdue alert calculation & resurrection
    │
    ├── routes/
    │   └── index.js           # API route registrations and URL endpoints
    │
    └── seed/
        └── seedData.js        # Realistic demo database seeder (4 projects, 20+ tasks)
```

---

## 🚀 Running the Server Independently

From the project root:
```bash
# Seed the database
npm run seed

# Start the server in watch mode
npm run dev:server

# Run the test suite
npm test
```
The backend runs on **[http://localhost:5001](http://localhost:5001)**.
