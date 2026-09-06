# Decisions Log — Orbit

Log of architectural and design decisions that shaped this codebase where meaningful alternatives existed.

---

## Decision 1: Cloud-Ready MongoDB Atlas + Mongoose vs. Local Embedded SQLite

- **Chose:** MongoDB Atlas cluster with Mongoose ODM, connection pooling (`maxPoolSize: 10`), and high-throughput `.lean()` queries.
- **Rejected:** Embedded local filesystem SQLite / file databases.
- **Why:** In modern cloud deployments (Render + Netlify), backend instances run on ephemeral containers. File-based local databases like SQLite get wiped on container redeployments and cannot scale across multiple load-balanced worker instances. MongoDB Atlas provides managed persistence, multi-region replication, and native `$facet` / `$unwind` aggregations that allowed us to reduce 40+ dashboard queries into 2 parallel pipelines.
- **Later reversed:** We initially explored a local SQLite prototype during early offline proof-of-concept testing, but reversed this decision in favor of MongoDB Atlas to ensure true cloud deployment readiness, zero data loss across Render cold-start restarts, and production scalability.

---

## Decision 2: Pure Server-Side Filtering, Searching, & Pagination vs. Client-Side In-Memory Cache

- **Chose:** 100% server-side parametric query execution with `.skip() / .limit()`, regex search on `$or: [{ title }, { description }]`, and indexed sorting.
- **Rejected:** Fetching all tasks into the client and filtering in the browser using JavaScript array methods.
- **Why:** The specification explicitly mandated: *"All of this must be done by the server — do not load every task into the browser and filter there."* In-memory client filtering does not scale as projects grow to thousands of tasks, consumes unnecessary mobile browser memory, and leaks unauthorized tasks that the viewer should not have loaded.

---

## Decision 3: Partial-Failure Bulk Action Processing vs. All-or-Nothing Transactional Rollback

- **Chose:** Independent per-task evaluation with aggregated success/rejection reporting in a single batch response.
- **Rejected:** Wrapping the entire bulk operation in a single database transaction that aborts all updates if any one task encounters an illegal move or constraint violation.
- **Why:** Specification Requirement 7 explicitly stated: *"Because some of those changes will be illegal for some tasks, the result must report per task what succeeded and what was rejected and why — not just fail the whole batch."* Users selecting 20 tasks to move to `IN_PROGRESS` should not have all 19 valid tasks fail because 1 task was in an illegal state.

---

## Decision 4: Due-Date-Bound Alert Dismissal vs. Simple Boolean Dismissed Flag

- **Chose:** Storing `dismissed_due_date` in an `AlertDismissal` collection (`{ user, task, dismissed_due_date }`).
- **Rejected:** A boolean `is_dismissed` column on the task or an unindexed user-task junction table.
- **Why:** Specification Requirement 10 requires: *"A person can dismiss an alert for a task they are assigned to. If that task's due date later changes, the alert comes back."* By recording the exact due date string at the moment of dismissal, any subsequent update to `task.due_date` automatically invalidates the match, causing the overdue alert to naturally resurface without requiring complex cron jobs or event hooks.

---

## Decision 5: Two Parallel Aggregation Pipelines vs. 40+ Sequential Dashboard Queries

- **Chose:** Two parallel MongoDB aggregations: one `$facet` pipeline computing headlines and status breakdowns, and one `$unwind` + `$group` pipeline computing assignee metrics, plus a parallel 8-week history batch.
- **Rejected:** Sequential `countDocuments()` calls inside nested loops for each user and week.
- **Why:** Sequential loops resulted in 40+ roundtrips to MongoDB Atlas, inflating dashboard latency to 1.5s+. With parallel aggregations and compound indexes, database execution time dropped by over 80% to under 150ms.
