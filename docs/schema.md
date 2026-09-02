# Data model

> **Read before you commit this.** Drafted from `server/src/models/`. The field
> tables are accurate as of this branch; sections marked **Your call** need your
> own reasoning.

MongoDB via Mongoose. Five collections. Mongoose `timestamps` maps to
`created_at` / `updated_at` on the two collections that use it.

## `users`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `name` | String | required, trimmed |
| `email` | String | required, **unique**, lowercased, trimmed |
| `password` | String | required; bcrypt hash, cost 10. Stripped by `toJSON` |
| `role` | String | required, enum `MANAGER` \| `MEMBER`, default `MEMBER` |
| `avatar_color` | String | default `#3b82f6`; used for identicon initials |
| `created_at` | Date | default now |

## `projects`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `key` | String | required, **unique**, uppercased, max 8 chars. The human prefix in `ALP-14` |
| `name` | String | required, trimmed |
| `description` | String | default `''` |
| `is_archived` | Boolean | default `false`. Archive hides, never destroys |
| `created_by` | ObjectId → users | who first created it; never changes |
| `owner` | ObjectId → users | accountable owner; settable and changeable |
| `members` | [ObjectId] → users | the access-control list |
| `created_at` / `updated_at` | Date | |

Indexes: `key` (unique), `members`, `is_archived`.

## `tasks`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `project` | ObjectId → projects | required |
| `task_number` | Number | required; per-project sequence, unique with `project` |
| `title` | String | required, trimmed |
| `description` | String | default `''` |
| `status` | String | required, enum `BACKLOG` \| `IN_PROGRESS` \| `IN_REVIEW` \| `BLOCKED` \| `DONE` |
| `previous_status` | String \| null | the state a `BLOCKED` task returns to |
| `priority` | String | required, enum `LOW` \| `MEDIUM` \| `HIGH` \| `URGENT` |
| `priority_rank` | Number | derived from `priority` on every save. See denormalisation below |
| `due_date` | String \| null | `YYYY-MM-DD`. See the date note below |
| `assignees` | [ObjectId] → users | |
| `blockers` | [ObjectId] → tasks | tasks that must be `DONE` before this one can be |
| `created_at` / `updated_at` | Date | |

Indexes: `{project, task_number}` (unique), `{project, status}`,
`{assignees, status}`, `{status, due_date}`, `{status, updated_at:-1}`,
`{priority_rank:-1}`.

## `task_activities` — the append-only ledger

| Field | Type | Notes |
|---|---|---|
| `task` | ObjectId → tasks | required |
| `user` | ObjectId → users | null for system-generated entries |
| `activity_type` | String | enum: `CREATED`, `STATUS_CHANGED`, `FIELD_UPDATED`, `ASSIGNED`, `UNASSIGNED`, `BLOCKER_ADDED`, `BLOCKER_REMOVED`, `COMMENT_ADDED` |
| `field_name` | String \| null | for `FIELD_UPDATED` |
| `old_value` / `new_value` | String \| null | value snapshots, as text |
| `comment_text` | String \| null | for `COMMENT_ADDED` |
| `created_at` | Date | default now |

Indexes: `{task, created_at}`, `{created_at:-1}`.

There is no update or delete path to this collection anywhere in the API —
immutability is enforced by the absence of an endpoint, not by a database
permission.

## `alertdismissals`

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId → users | required |
| `task` | ObjectId → tasks | required |
| `dismissed_due_date` | String | required; the due date the dismissal was made against |
| `dismissed_at` | Date | default now |

Index: `{user, task}` unique — one dismissal per person per task.

Storing the due date the dismissal was made *against* is what makes the
resurface rule work without a scheduled job: the alert query compares the
stored value with the task's current `due_date`, and any reschedule makes them
differ, so the alert reappears on the next poll.

## Relationships

| Relationship | Cardinality | How it's stored |
|---|---|---|
| Project → Tasks | one-to-many | `project` ref on the task |
| Project → Owner / Creator | many-to-one | refs on the project |
| Project ↔ Members | many-to-many | `members` array on the project |
| Task ↔ Assignees | many-to-many | `assignees` array on the task |
| Task ↔ Blockers | many-to-many, self-referential, acyclic | `blockers` array on the task |
| Task → Activities | one-to-many | `task` ref on the activity |
| (User, Task) → Dismissal | one-to-one | compound unique index |

Both many-to-many relationships are stored as arrays on one side rather than in
a join collection. That is cheap to read (one `populate`, no join) and fine at
this scale, but it means the reverse query — "every task assigned to this
person" — relies on a multikey index rather than a primary key lookup.

## Constraints: database vs application

**Enforced by MongoDB** — unique `email`, unique project `key`, unique
`{project, task_number}`, unique `{user, task}` dismissal, all enum membership
and `required` checks via Mongoose validation.

**Enforced only in application code** — everything interesting:

- which status transitions are legal, and that `DONE` is refused while a blocker
  is unfinished (`services/taskLifecycle.js`);
- that a blocker is in the same project as the task it blocks;
- that adding a blocker cannot close a dependency cycle (BFS over dependents);
- that only project members may be assigned to a task;
- that a project's owner cannot be removed from its member list;
- role checks, and project scoping for non-managers;
- generation of the next `task_number`.

That split is the main risk surface in this design: nothing at the database
level would stop a second writer, or a script, from creating an illegal state.

## Deliberate denormalisation

1. **`priority_rank`** duplicates `priority` as a number. `priority` is a string
   enum, so sorting on it directly is alphabetical — `HIGH, LOW, MEDIUM, URGENT` —
   which is not an ordering anyone wants. The rank is derived on every save by a
   `pre('validate')` hook, so the two cannot drift.
2. **Activity values are text snapshots.** `old_value` and `new_value` store
   rendered strings, not references. A renamed user or a deleted task does not
   rewrite history, which is the point of the ledger.
3. **Task codes are not stored.** `ALP-14` is composed at read time from the
   project key and `task_number`, so renaming a project key updates every code.
   The trade is that a task cannot be looked up by its code without a join.

## What breaks first at 100× data

In roughly the order it would hurt:

1. **Text search.** `q` is compiled into a `RegExp` and matched against `title`
   and `description` with no text index, so every search is a full scan of the
   task collection. This is the first thing to fall over, and the fix is a
   proper `$text` index.
2. **The activity feed.** `getGlobalFeed` resolves the accessible task ids into
   an array and passes it to `$in`. At a hundred thousand tasks that array is
   the query.
3. **The dashboard.** Eight `countDocuments` calls plus two aggregations, all
   unbounded over the whole portfolio, on every page load. It needs either a
   materialised rollup or a date-bounded aggregation.
4. **Cycle detection.** `wouldCreateCycle` issues one query per node visited.
   Fine for the dependency depths a real project has; pathological on a deep
   chain, and there is no depth cap.
5. **Project list task counts.** One aggregation over every task, on every
   sidebar render.

> **Your call:** the `due_date` is a `String` in `YYYY-MM-DD` rather than a
> `Date`. That is why the overdue comparisons are string comparisons and why
> there is no timezone handling — "today" is computed in UTC. Whether that was
> a deliberate simplification or something you'd change is exactly the kind of
> question you will be asked. Answer it here in your own words.
