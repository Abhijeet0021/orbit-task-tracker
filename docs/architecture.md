# Architecture

> **Read before you commit this.** This file was drafted from the code as it
> stands. The factual parts are accurate; the parts marked **Your call** are
> judgement calls that must be yours, because you will be asked about them.

## The moving pieces

Four pieces, three of which run somewhere different.

| Piece | What it is | Where it runs |
|---|---|---|
| **Browser client** | React 18 SPA, Vite build, Tailwind for styling, React Router for navigation | Netlify static hosting; also served from the API's `dist/client` if that directory exists |
| **API** | Node 20 + Express 4, one process, stateless | Render web service, free plan |
| **Database** | MongoDB via Mongoose 9 | MongoDB Atlas M0 shared cluster |
| **Seeder** | One-shot script that wipes and repopulates demo data | Run manually against whichever database `MONGODB_URI` points at |

There is no queue, no cache and no background worker. Everything happens inside
the request that triggered it.

## How they talk

The client talks to the API over JSON/HTTPS and nothing else — there is no
direct database access from the browser. `client/src/api/client.js` is the only
module that calls `fetch`; every page and component goes through it. It reads
its base URL from `VITE_API_URL` at build time, falling back to the deployed
Render URL in production builds and to `/api` in development, where Vite proxies
that path to `localhost:5001`.

Authentication is a bearer JWT, signed with `JWT_SECRET`, valid for 7 days, held
in `localStorage` and attached to every request by the API client. The API is
stateless: there is no session store, and the token is re-verified on each
request. `authenticate` decodes it and re-reads the user from the database, so a
deleted user's token stops working immediately.

CORS is an explicit allow-list plus a regex for `*.netlify.app`, so preview
deploys work without reconfiguration.

## Layering inside the API

```
routes/index.js        URL → middleware → controller. No logic.
middleware/auth.js     authenticate (JWT) · requireManager (role) · hasProjectAccess (scope)
controllers/*.js       HTTP concerns: read the request, call services, shape the response
services/
  taskLifecycle.js     The state machine, blocker rules, and cycle detection
  auditService.js      Writing and reading the append-only activity ledger
models/*.js            Mongoose schemas, indexes, and the constraints the DB enforces
```

The rule the codebase follows is that **every business rule lives on the server**,
and the client only ever renders what the server tells it is legal. The task
detail view, for example, does not compute which transitions to show — it
renders the `legalTransitions` array the API returned, including the `allowed`
flag and the `blockReason` string for options that are visible but refused.

## One request end to end

A member drags a task from **In Review** to **Done** on the Kanban board.

1. `KanbanBoard.onDragEnd` fires with the task id and the destination column id,
   which is also the target status. No optimistic update — the board waits.
2. `api.updateTask(id, { status: 'DONE' })` sends `PUT /api/tasks/:id` with the
   bearer token.
3. `authenticate` verifies the JWT and loads the user onto `req.user`.
4. `TaskController.updateTask` loads the task with its project populated, then
   calls `hasProjectAccess`. A member who is not in `project.members` gets 403
   here; a manager always passes.
5. `TaskLifecycleService.validateTransition(task, 'DONE')` runs:
   - `getUnfinishedBlockers` queries the tasks listed in `task.blockers` whose
     status is not `DONE`.
   - `getLegalTransitions('IN_REVIEW', …)` returns the options for that state.
     `DONE` is present but carries `allowed: false` and a `blockReason` naming
     the offending tasks if any blocker is unfinished.
   - An illegal target (say `BACKLOG` → `DONE`) is not in the list at all and
     comes back with a message listing what *is* allowed.
6. On failure the controller returns **400** with that message, the board shows
   it in a toast and re-fetches so the card snaps back.
7. On success the status is written, `previous_status` is recalculated (set when
   entering `BLOCKED`, cleared when leaving it), a `STATUS_CHANGED` row is
   appended to `task_activities` with the old and new value and the acting user,
   and the task is saved.
8. The board calls `onRefresh`, which re-runs the project's task query, and the
   card renders in its new column.

## What is deliberately not built

- **No refresh tokens or logout-everywhere.** A 7-day JWT with no server-side
  revocation list. Losing a token means losing it for 7 days.
- **No transactions.** Multi-step writes (update a task, then append its audit
  rows) are not atomic. On a single-node M0 cluster this is a real trade-off
  rather than a free win, but it is a known gap.
- **No soft delete for tasks.** `DELETE /tasks/:id` removes the document. Its
  activity rows survive but no longer resolve to a task.
- **No websockets.** The alert badge polls every 60 seconds; everything else
  refetches on navigation or after a mutation.
- **No file attachments, no notifications, no time tracking.**

> **Your call:** the list above is what the code shows you didn't build. What
> the reviewer actually wants to know is *why* — what you consciously traded
> away and what you'd add first with another day. Rewrite this section in your
> own words before submitting; a list of absences with no reasoning behind it
> reads as an oversight rather than a decision.
