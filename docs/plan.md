# Plan

> **This file is yours to write. I have not filled it in, because a plan I
> invented is one you cannot defend on a call.** What follows is the set of
> questions the brief says this file must answer, plus the facts I could
> establish from the repository. Replace every prompt with your own answer.

## How I split the work into sessions

`Answer here.`

What the git history shows, so your answer matches the record: all 16 commits
land on 2 September between 13:20 and 17:17 — one session of just under four
hours. The first commit contains the finished application (53 files, 12,782
lines); the fifteen after it are deployment configuration, CORS fixes, a
performance pass and README edits.

The brief budgeted about twelve hours across a week. Say what actually happened
and why. If you built it in one long sitting, say that. If you worked things out
elsewhere before committing, say that and describe how. An honest account of a
compressed schedule reads far better than a plan reverse-engineered to look
tidy — and the reviewer already has the commit timestamps.

## What order I built in, and why

`Answer here.`

Prompts, in case they help you reconstruct it: did the schema come before the
API or after? Was the lifecycle state machine designed up front or extracted
once the status handling got messy? Did the React pages come after the endpoints
they call, or did you stub them? When did MongoDB enter the picture — commit
`1d5f9f8` is "migrate to MongoDB (Mongoose)", which implies something came
before it. That migration is worth a paragraph of its own.

## Estimated versus actual

`Answer here.`

Pick three or four pieces of work and give both numbers. Deployment is usually
the honest one — there are eight commits in this history that are purely about
getting Render and Netlify to cooperate (`f1b9e6d`, `6ee51d4`, `2e07bd3`,
`fb01dd1`, `9cb3972`, `a6ba51e`), which suggests hosting cost noticeably more
than expected. If so, say so and say what you'd do differently.

## What I cut when I ran short

`Answer here.`

Things that are demonstrably absent, if any of these were conscious cuts rather
than oversights — say which: HTTP-level tests, any frontend tests, rate limiting
and other hardening, transactions around multi-step writes, a `completed_at`
field, timezone handling for "today".

## Second pass

`Answer here, if it applies.`

If you did a review-and-fix pass after the initial build, describe it: what you
went looking for, what you found, what you decided not to fix and why. Work done
with AI assistance belongs in `ai-prompts.md`, but the shape of the pass belongs
here.
