# AI prompts

> **The last section of this file is a factual record of an assisted session I
> can vouch for. Everything above it is yours to fill in.** The brief is
> explicit that this file must contain the prompts you actually used, including
> the ones that produced bad output and what you changed afterwards.

## How I worked

`Answer here.` Which tools, at what points, and for what. If parts of this were
written without AI assistance, say which and describe how you worked instead —
the brief says that is assessed the same way.

## Session 1 — building the application (2 September)

`Answer here.`

Group the prompts by what you were trying to do — scaffolding, the state
machine, the React pages, the MongoDB migration, deployment — and give them in
order. Paste the prompts as you actually typed them, not cleaned-up versions.

## At least one prompt that produced something wrong

`Answer here — this one is required and it is the part reviewers read closest.`

What you asked for, what came back, how you noticed it was wrong, and what you
did about it. A candidate who can point at bad generated output and explain why
it was bad is demonstrating exactly the judgement being assessed.

Some candidates for this, all real defects that were in the code at the end of
session 1 — if any of them came out of a prompt, this is where to say so:

- `TaskDetailModal` passed a prop named `onCommentAdded` to a `TaskTimeline`
  that destructured `onRefresh`, so posting a comment threw and showed a failure
  message on a comment that had actually saved.
- The CSV export URL was passed to `window.open`, which sends no `Authorization`
  header, so the export returned 401 every time.
- The create-task form sent `blocker_ids` that the controller never read.
- `ActivityFeedPage` and `CommandPalette` were built in full and never imported,
  routed or mounted.
- Five task sub-resource routes had no project access check, so any member could
  act on any task in any project.

## Session 2 — review and fixes

This section is a factual record of an assisted review session run against the
repository after session 1. It is written from the actual transcript.

**Prompt 1** — *"go through the project and find bugs or error and more i can do
to make my assignment project better"*

Produced a review of all 61 source files: 34 findings across broken features,
RBAC gaps, server correctness, test coverage and polish. Three findings were
verified by running code rather than by reading it — that `new RegExp("(")`
throws and so a search for `(` returns a 500; that the timeline's
`"YYYY-MM-DD HH:MM:SS"` timestamps are parsed as local time and therefore
display 5h30m early in IST; and that Mongoose's timestamp hook overwrites an
explicitly-set `updated_at` on insert, which is why the seeded completion dates
are wrong.

**Prompt 2** — *"okk"*, accepting an offer to fix the top items.

Produced five commits: the RBAC guards on the five unprotected routes, the
comment-posting prop mismatch, the authenticated CSV download, `blocker_ids` on
task creation, and the routing for the activity feed and command palette.

*What I had to correct:* the initial plan was to mount the existing
`requireProjectAccess` middleware on the five routes. That would have been
wrong — the middleware reads a project id from `req.params.id`, but on
`/tasks/:id/assignees` that parameter is a *task* id, so the check would have
compared a task id against project membership and returned 403 for every member
and true for every manager. The fix was an in-handler `hasProjectAccess(task.project, …)`
call instead. `requireProjectAccess` is still dead code.

*Also caught in review:* the first version of the owner guard in `removeMember`
was placed after the unassignment loop, so a refused removal would still have
unassigned the user from every task in the project first. It was moved above the
loop before committing.

**Prompt 3** — the assignment brief itself, with *"above project should be under
given readme"*.

Produced a conformance check against the ten goals — six met, four partial — and
identified the missing `docs/` directory and `SUBMISSION.md`. Then four commits
closing the partial goals: project owner, same-project blockers, priority sort
order, and real old/new values on description edits.

*What was declined:* rewriting or backdating the git history to disguise that
the application was built in a single four-hour session. That would have been a
misrepresentation. `docs/plan.md` states the actual shape of the work instead.

*What was refused as ghostwriting:* `plan.md`, `decisions.md` and this file's
earlier sections were left as prompts rather than filled in, on the grounds that
they are a record of the author's thinking and inventing them would produce
answers the author could not defend.

**Prompt 4** — a screenshot of the login page showing "HTTP 500 Internal Server
Error", and *"resolve this"*.

*What I got wrong first, and it is worth recording.* Reasoning from the code
alone, I identified a real regression — commit `121d9b5` had silently deleted
the `mongodb+srv` port-stripping added in `2e07bd3` — and concluded it explained
the 500. It did not. Reaching the deployed API through a browser showed it was
healthy and that login returned 200 with a valid token. The regression was real
and worth fixing, but it was not the cause, and I had presented a plausible
story as a diagnosis before checking it.

The actual cause was local: no `.env` file, so `MONGODB_URI` was unset, the
server fell back to `localhost:27017` with nothing listening, `startServer()`
was called without a `.catch()` so the rejection went unhandled, and the Vite
dev proxy answered the dead upstream with a bare HTML 500 that the API client
rendered as `HTTP 500 Internal Server Error`. The message came from the proxy,
not from the application.

*And then a second one, of my own making.* The `priority_rank` hook added
earlier in this session was written as `pre('validate', function (next) { …
next(); })`. Mongoose 9 removed callback-style middleware — hooks are called
with no arguments — so every `Task` validation threw `next is not a function`
and the seeder died partway through. It was reproducible in two lines with no
database at all (`new Task({…}).validate()`), which is how it should have been
checked before committing rather than after the user hit it.

The lesson worth carrying into the interview: both mistakes came from asserting
behaviour instead of executing it. The regression looked like a cause because it
was the kind of thing that *would* cause it; the hook looked correct because it
matched an older Mongoose API. One `curl` and one two-line script would have
caught them respectively.

> **Before you submit:** read every file in `docs/`. Anything you cannot explain
> in your own words should be changed until you can, or removed.
