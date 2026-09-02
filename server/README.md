# ⚙️ Server (Backend Application & MongoDB Engine)

This directory contains the **Node.js Express REST API**, powered by **MongoDB (Mongoose ODM)** with strict schema validation, state machine lifecycle transitions, and append-only activity ledgers.

---

## 📁 Directory Structure

```
server/
├── tests/
│   └── taskTracker.test.js    # 14/14 Automated integration tests (Vitest + MongoMemoryServer)
│
└── src/
    ├── index.js               # Express application entry point (port 5001) & /api/health
    │
    ├── config/
    │   └── database.js        # Mongoose connection & mongodb+srv URI port sanitization
    │
    ├── models/                # Mongoose Schemas & Models
    │   ├── User.js            # User accounts & RBAC roles (MANAGER, MEMBER)
    │   ├── Project.js         # Projects & member associations
    │   ├── Task.js            # Tasks with assignees, blockers & status enum
    │   ├── TaskActivity.js    # Immutable append-only audit & comment entries
    │   └── AlertDismissal.js  # Overdue alert dismissal state per user
    │
    ├── middleware/
    │   └── auth.js            # JWT verification & RBAC authorization middleware
    │
    ├── services/
    │   ├── taskLifecycle.js   # Finite State Machine & blocker cycle detection algorithm
    │   └── auditService.js    # Immutable append-only activity & comment ledger
    │
    ├── controllers/
    │   ├── authController.js       # Login & /api/auth/me session
    │   ├── projectController.js    # Projects CRUD, archiving & member auto-unassignment
    │   ├── taskController.js       # Tasks CRUD, assignees, blockers & CSV export
    │   ├── bulkController.js       # Atomic batch operations with per-task reporting
    │   ├── dashboardController.js  # Portfolio KPI aggregations & 8-week cadence
    │   └── alertController.js      # Overdue SLA alert calculation & resurfacing
    │
    ├── routes/
    │   └── index.js           # Express API route registrations (/api/*)
    │
    └── seed/
        └── seedData.js        # Realistic demo database seeder (4 projects, 20+ tasks)
```

---

## 🚀 Running the Server Independently

From the project root:
```bash
# Seed local or cloud database
npm run seed

# Start server in watch mode
npm run dev:server

# Run the integration test suite
npm test
```
The backend runs on **[http://localhost:5001](http://localhost:5001)**.
