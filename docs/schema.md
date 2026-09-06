# Database Schema & Data Architecture Document — Orbit

## 1. Schema Definitions & Mongoose Models

### `User` Model
| Field | Type | Options & Constraints | Description |
|---|---|---|---|
| `_id` | `ObjectId` | Auto-generated 24-char Hex | Unique user identifier |
| `name` | `String` | `required: true, trim: true` | User display name |
| `email` | `String` | `required: true, unique: true, lowercase: true, trim: true` | Login email address |
| `password` | `String` | `required: true` | Salted bcrypt hash |
| `role` | `String` | `enum: ['MANAGER', 'MEMBER'], default: 'MEMBER'` | RBAC role |
| `avatar_color`| `String` | `default: '#3b82f6'` | Visual avatar hex color |
| `created_at` | `Date` | Managed via timestamps | Account creation timestamp |
| `updated_at` | `Date` | Managed via timestamps | Account update timestamp |

**Indexes:**
- `{ email: 1 }` (Unique, case-insensitive)

---

### `Project` Model
| Field | Type | Options & Constraints | Description |
|---|---|---|---|
| `_id` | `ObjectId` | Auto-generated 24-char Hex | Unique project identifier |
| `key` | `String` | `required: true, unique: true, uppercase: true, trim: true, maxlength: 8` | Short project prefix (e.g. `ALP`, `BIL`) |
| `name` | `String` | `required: true, trim: true` | Human-readable project name |
| `description` | `String` | `default: ''` | Project overview |
| `is_archived` | `Boolean` | `default: false` | Soft-archival flag |
| `created_by` | `ObjectId` | `ref: 'User'` | Creator (Manager) |
| `members` | `[ObjectId]` | `ref: 'User'` | Array of assigned team members |
| `created_at` | `Date` | Managed via timestamps | Creation timestamp |
| `updated_at` | `Date` | Managed via timestamps | Update timestamp |

**Indexes:**
- `{ key: 1 }` (Unique)
- `{ members: 1 }` (Multikey index for fast user project filtering)
- `{ is_archived: 1 }` (Active project filtering)

---

### `Task` Model
| Field | Type | Options & Constraints | Description |
|---|---|---|---|
| `_id` | `ObjectId` | Auto-generated 24-char Hex | Unique task identifier |
| `project` | `ObjectId` | `ref: 'Project', required: true` | Parent project |
| `task_number` | `Number` | `required: true` | Monotonic sequential number per project |
| `title` | `String` | `required: true, trim: true` | Task title |
| `description` | `String` | `default: ''` | Task description |
| `status` | `String` | `enum: ['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'], default: 'BACKLOG'` | Lifecycle status |
| `previous_status` | `String` | `enum: ['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', null], default: null` | Saved state before being blocked |
| `priority` | `String` | `enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM'` | Priority tier |
| `due_date` | `String` | `default: null` | ISO date string (`YYYY-MM-DD`) |
| `assignees` | `[ObjectId]` | `ref: 'User'` | Array of assigned members |
| `blockers` | `[ObjectId]` | `ref: 'Task'` | Array of blocking tasks |
| `created_at` | `Date` | Managed via timestamps | Creation timestamp |
| `updated_at` | `Date` | Managed via timestamps | Update timestamp |

**Targeted Compound Indexes:**
- `{ project: 1, task_number: 1 }` (Unique compound index)
- `{ project: 1, status: 1 }` (Project-scoped status filtering & Kanban)
- `{ assignees: 1, status: 1 }` (User task lookups & aggregated dashboard)
- `{ status: 1, due_date: 1 }` (Overdue SLA calculations)
- `{ status: 1, updated_at: -1 }` (8-week completion history & recent changes)

---

### `TaskActivity` Model (Immutable Audit Log)
| Field | Type | Options & Constraints | Description |
|---|---|---|---|
| `_id` | `ObjectId` | Auto-generated 24-char Hex | Unique event identifier |
| `task` | `ObjectId` | `ref: 'Task', required: true` | Target task |
| `user` | `ObjectId` | `ref: 'User'` | Actor |
| `activity_type`| `String` | `enum: ['CREATED', 'STATUS_CHANGED', 'FIELD_UPDATED', 'ASSIGNED', 'UNASSIGNED', 'COMMENT_ADDED', 'BLOCKER_ADDED', 'BLOCKER_REMOVED']` | Event type |
| `field_name` | `String` | `default: null` | Modified field name |
| `old_value` | `String` | `default: null` | Previous state |
| `new_value` | `String` | `default: null` | New state |
| `comment_text`| `String` | `default: null` | Comment message text |
| `created_at` | `Date` | `default: Date.now` | Audit timestamp |

**Indexes:**
- `{ task: 1, created_at: 1 }` (Chronological task timeline lookup)
- `{ created_at: -1 }` (Global activity feed)

---

### `AlertDismissal` Model
| Field | Type | Options & Constraints | Description |
|---|---|---|---|
| `_id` | `ObjectId` | Auto-generated 24-char Hex | Unique dismissal identifier |
| `user` | `ObjectId` | `ref: 'User', required: true` | Dismissing user |
| `task` | `ObjectId` | `ref: 'Task', required: true` | Target task |
| `dismissed_due_date`| `String` | `required: true` | Exact due date when dismissed |
| `dismissed_at` | `Date` | `default: Date.now` | Dismissal timestamp |

**Indexes:**
- `{ user: 1, task: 1 }` (Unique compound index)

---

## 2. High-Performance Aggregation Design

### Executive Dashboard Pipeline
To avoid $40+$ sequential queries, the dashboard uses two parallel MongoDB aggregations:

1. **Faceted Headline & Status Aggregation (`Task.aggregate`)**:
   ```javascript
   Task.aggregate([
     { $match: { project: { $in: allowedProjectIds } } },
     {
       $facet: {
         headline: [
           {
             $group: {
               _id: null,
               openTasks: { $sum: { $cond: [{ $ne: ['$status', 'DONE'] }, 1, 0] } },
               overdueTasks: {
                 $sum: {
                   $cond: [
                     { $and: [{ $ne: ['$status', 'DONE'] }, { $ne: ['$due_date', null] }, { $lt: ['$due_date', todayStr] }] },
                     1,
                     0
                   ]
                 }
               },
               dueThisWeek: {
                 $sum: {
                   $cond: [
                     { $and: [{ $ne: ['$status', 'DONE'] }, { $gte: ['$due_date', todayStr] }, { $lte: ['$due_date', nextWeekStr] }] },
                     1,
                     0
                   ]
                 }
               },
               completedThisWeek: {
                 $sum: {
                   $cond: [
                     { $and: [{ $eq: ['$status', 'DONE'] }, { $gte: ['$updated_at', lastWeek] }] },
                     1,
                     0
                   ]
                 }
               }
             }
           }
         ],
         statusBreakdown: [
           { $group: { _id: '$status', count: { $sum: 1 } } }
         ]
       }
     }
   ])
   ```

2. **Assignee Workload Aggregation**:
   ```javascript
   Task.aggregate([
     { $match: { project: { $in: allowedProjectIds } } },
     { $unwind: '$assignees' },
     {
       $group: {
         _id: '$assignees',
         active_tasks_count: { $sum: { $cond: [{ $ne: ['$status', 'DONE'] }, 1, 0] } },
         overdue_tasks_count: {
           $sum: {
             $cond: [
               { $and: [{ $ne: ['$status', 'DONE'] }, { $ne: ['$due_date', null] }, { $lt: ['$due_date', todayStr] }] },
               1,
               0
             ]
           }
         },
         completed_tasks_count: { $sum: { $cond: [{ $eq: ['$status', 'DONE'] }, 1, 0] } }
       }
     }
   ])
   ```

---

## 3. 100x Scaling Strategy

1. **Read/Write Splitting**: Route analytical dashboard queries to MongoDB secondary read replicas using `readPreference: 'secondaryPreferred'`.
2. **Horizontal Sharding**: Shard the `tasks` collection using `{ project: 'hashed' }` to distribute high-volume projects evenly across shards.
3. **Audit Log Archiving**: Partition `task_activities` using TTL or time-series collection bucketing for historical events older than 1 year.
4. **Caching Tier**: Implement Redis caching with a 60-second TTL for executive portfolio headline metrics and user permission maps.
