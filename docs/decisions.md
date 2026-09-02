# Decisions

> **This file is yours to write.** The brief asks for at least five real
> decisions — what you chose, what you rejected, and why — including at least
> one you later reversed. I have listed the decision *points* I can see in the
> code and the history; the reasoning has to be yours, because that reasoning is
> what is being assessed.

Use this shape for each one:

```
## <the decision>
**Chose:** …
**Rejected:** …
**Why:** …
**How it turned out:** …
```

---

## Decision points visible in the code

Pick five or more of these, or better ones of your own.

**1. MongoDB over a relational database.** Commit `1d5f9f8` is a migration to
Mongoose, and `.gitignore` still lists `*.sqlite`, so something relational came
first. This is the most interesting decision in the repository and the one most
likely to be asked about. Why did you switch? What did the data model gain or
lose? The application now enforces referential rules — same-project blockers,
member-only assignment, cycle-freedom — that a relational schema could have
enforced with constraints. Was that trade deliberate?

**2. Storing `due_date` as a `YYYY-MM-DD` string rather than a `Date`.** It
makes the overdue comparison a string comparison and sidesteps timezones — at
the cost of no timezone handling at all. Deliberate simplification, or something
you'd change?

**3. Transitions computed on the server and rendered by the client.** The task
detail view renders whatever `legalTransitions` the API returns, including
disabled options with a `blockReason`. The alternative — encoding the state
machine in the client too — would be faster but duplicated. Why this way?

**4. An append-only ledger with no update or delete endpoint**, rather than
immutability enforced at the database level. What does that not protect against?

**5. Membership stored as an array on the project** rather than a join
collection. Cheap reads, multikey index on the reverse query. At what size does
that stop being the right call?

**6. Bulk operations that report per task instead of failing atomically.** The
brief asked for this, but there was still a choice in how far to take it — the
loop keeps going after a rejection and returns a per-task reason. Would a
transactional all-or-nothing version have been better or worse for the user?

**7. A denormalised `priority_rank` alongside `priority`.** Added so that
sorting by priority orders by severity rather than alphabetically. The
alternatives were an aggregation pipeline with `$switch` at query time, or
storing the priority as a number and mapping to labels in the UI.

## At least one you reversed

`Answer here.`

The history has candidates — the relational-to-MongoDB migration is the obvious
one. Commit `95f1ebf` adds a second accepted password for demo logins and the
code no longer does that, so that was reversed too. If you reversed something
during a later review pass, that counts as well. Describe what you originally
did, what made you change your mind, and what the change cost.
