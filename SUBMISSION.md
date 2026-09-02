# Submission — Assignment 01, Project & Task Tracking

> **CHECK EVERY LINE MARKED `TODO` BEFORE SUBMITTING.**

## Links

| | |
|---|---|
| **Repository** | https://github.com/Abhijeet0021/orbit-task-tracker |
| **Live application** | `TODO — the Netlify URL you actually want reviewed` |
| **API** | https://orbit-task-tracker-api.onrender.com |
| **Health check** | https://orbit-task-tracker-api.onrender.com/api/health |

## ⚠️ First load is slow

The API is on Render's free plan, which spins the service down after a period of
inactivity. **The first request after an idle period can take up to a minute**
while the container wakes; the frontend shows an "Authenticating…" state during
that time. It is not a broken deployment. Hitting the health check URL above
first will wake it before you try to log in.

## Demo credentials

Every account uses the password **`password123`**.

| Name | Email | Role | Scope |
|---|---|---|---|
| Sarah Connor | `manager@acme.com` | MANAGER | Whole portfolio. Creates and archives projects, manages members, deletes tasks |
| Alex Rivera | `member1@acme.com` | MEMBER | Alpha Cloud, Billing Engine, Legacy Migration |
| Devon Vance | `member2@acme.com` | MEMBER | Alpha Cloud, Mobile App |
| Elena Rostova | `member3@acme.com` | MEMBER | Billing Engine, Mobile App |

The login page has one-click buttons for each persona, and the navbar has a
persona switcher, so you can see the role and scoping differences without
logging out.

## Seeded data

Four projects (one archived, to demonstrate that archiving hides without
destroying), tasks across every lifecycle state including blocked ones with real
dependency chains, overdue tasks assigned to members so the alerts area is
populated, and eight weeks of completed tasks behind the dashboard chart.

## What to look at first

`TODO — three or four things you are proudest of and want a reviewer to see.
Suggestions, pick your own: the lifecycle state machine in
server/src/services/taskLifecycle.js; the cycle detection in wouldCreateCycle;
the per-task success/failure reporting in the bulk action modal; the overdue
alert resurface rule.`

## Goals covered

| # | Goal | Status |
|---|---|---|
| 1 | Accounts and roles | Done |
| 2 | Projects | Done |
| 3 | Tasks inside projects | Done |
| 4 | Task lifecycle with rules | Done |
| 5 | Assignment | Done |
| 6 | Finding things | Done |
| 7 | Bulk actions and CSV export | Done |
| 8 | Dashboard | Done |
| 9 | History you cannot rewrite | Done |
| 10 | Overdue alerts | Done |

### Stretch items also built

- Drag-and-drop Kanban board on the project page.
- Cycle detection across dependency chains, not just direct A↔B (BFS over the
  dependents graph in `TaskLifecycleService.wouldCreateCycle`).
- Activity feed across all projects, with project / person / event filters.
- Keyboard-driven navigation — ⌘K / Ctrl+K command palette.

## Known gaps

`TODO — be honest here; it reads better than silence. Candidates for this list
based on the current state of the branch:`

- No transactions: a task update and its audit rows are written separately.
- "Today" is computed in UTC, so overdue flips at 05:30 for a UTC+5:30 user.
- Dashboard completions are dated by `updated_at`; there is no `completed_at`.
- Tests exercise controllers directly rather than through HTTP, so the routing
  and auth middleware layer is untested.
- No rate limiting on login.

## Running it locally

```bash
npm install
cp .env.example .env      # then set MONGODB_URI and JWT_SECRET
npm run seed              # wipes and repopulates the demo data
npm run dev               # client on :5173, API on :5001
npm test                  # integration suite, in-memory MongoDB
```

`npm test` downloads a MongoDB binary on first run, so the first invocation
needs network access and takes a minute.
