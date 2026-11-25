# DevSync: Build and Verify

Build a working third-year BTech **AI-Assisted Developer Collaboration Platform**. Implement, run, test, fix, and document it; a static prototype is insufficient.

## Boundaries

- Read applicable `AGENTS.md`; inspect Git status and relevant files. In this Casework/RSAICDP workspace, use a new `devsync/` folder and preserve existing code, changes, data, ports, and volumes. In an empty repository, use its root.
- Proceed with reasonable choices. Local work is authorized; publishing, pushing, purchases, and external messages require separate authorization.
- Keep the modular monolith simple. No microservices, live editor, code runner, video calls, chat, or optional features before acceptance passes. Do not delegate unless explicitly authorized; add dependencies only for concrete needs.

## Token-efficient execution policy

Optimize **total agent tokens needed to reach a verified result**, including repeated context, tool output, debugging, and rework. Shorter instructions or fewer tool calls alone do not establish efficiency. Spend tokens on understanding dependencies and checking contracts when that prevents costly rework. No fixed token cap is imposed; required correctness and evidence remain mandatory.

1. **Load context selectively.** Read this specification once per context. Inspect manifests, entry points, applicable instructions, and files needed for the current slice; use `rg` and line ranges instead of repository dumps. Exclude dependency/generated directories from ordinary searches. Discover only relevant tool schemas, not entire tool catalogs. Verify uncertain versions/APIs using official sources; reuse findings unless new evidence warrants another lookup.
2. **Keep a compact checkpoint.** Maintain `BUILD_STATUS.md` with current slice, key decisions, changed paths, working commands/ports, acceptance IDs covered or pending, last check results, blockers, and exact next action. Update at milestones or before handoff, not every tool call. After interruption, read it and relevant spec/code sections; do not restart discovery or assume incomplete checks passed. Recover omitted requirements before final acceptance.
3. **Implement cohesive slices.** Decide each slice's DTOs, permissions, persistence, and success criteria before editing. Reuse existing conventions, shared components, fixtures, and helpers. Batch related edits, compile early, then exercise the slice. Avoid speculative abstractions, competing implementations, and cosmetic rewrites of finished code.
4. **Bound tool output.** Batch independent reads/checks; keep dependent mutations sequential. Request only relevant paths, ranges, fields, and diff hunks. Capture verbose build/test logs once to files; return command, exit code, test totals, and failure excerpts. On failure, inspect the first causal error and expand only as needed. Ensure wrappers preserve failure exit codes. Do not dump lockfiles, dependency trees, binary/base64 data, or successful full logs into context.
5. **Reuse the runtime.** Check tool/service availability once, start one isolated development stack, and reuse it. Reload/rebuild only affected components. Preserve the separate disposable acceptance environment where required. Avoid repeated installs, environment probes, and server restarts without a relevant change or diagnostic reason.
6. **Diagnose before retrying.** Record the failed command, causal evidence, and intended fix. After applying the fix, rerun the smallest meaningful check. If the same failure recurs, gather new evidence or change the hypothesis; do not repeat an unchanged command hoping for success. External blockers should not prevent independent progress.
7. **Test by impact, then integrate.** Run focused checks during development and the complete mandatory suite at the integration checkpoint. After fixes, rerun affected gates; broaden when shared auth, schema, configuration, or cross-module behavior changes. Reuse still-valid results rather than rerunning unchanged expensive suites. Never omit a gate, hide skipped tests, or weaken assertions to reduce token use.
8. **Use browser evidence purposefully.** Reuse test accounts/fixtures and browser contexts within a run. Inspect targeted UI state for decisions; capture required screenshots and failure evidence. Avoid repeated unchanged full-page snapshots. Browser automation must still exercise the real stack and all required scenarios.
9. **Report once, reference evidence.** Give concise milestone/blocker updates. Store commands/results in `VERIFICATION.md` and link artifacts from other documents instead of copying transcripts. Final handoff should summarize verified outcomes and limitations without replaying the work history.
10. **Measure honestly.** If the execution environment exposes actual token usage, record it without inventing per-step estimates. Otherwise mark token usage unavailable. Record useful existing metrics such as suite runs, retries, and checkpoints only when readily available; word counts and tool-call counts are proxies, not measured token savings. Do not build a separate monitoring system for this task.

## Stack and structure

- **Backend:** Java 21, compatible maintained Spring Boot, Maven Wrapper, Web, Security, Bean Validation, Data JPA; MySQL 8.4 and Flyway.
- **Frontend:** React, TypeScript, Vite, Bootstrap. Responsive, accessible UI with real persisted data.
- **Auth:** server sessions, BCrypt, HttpOnly cookies, CSRF protection; Secure cookies over HTTPS with explicit local HTTP configuration.
- **Runtime:** Docker Compose, persistent MySQL volume, readiness/health checks, frontend proxy for same-origin `/api`; also document local development.
- **Tests:** JUnit, Testcontainers MySQL integration tests, useful frontend tests, Playwright against the real stack. No H2 substitution or mocked core APIs in acceptance tests.
- Pin compatible dependencies, commit the frontend lockfile, document runtime versions. Keep secrets server-side and ignored; provide `.env.example`. Keep the local database internal or loopback-bound.

Backend modules: `identity`, `projects`, `workitems`, `discussion`, `notifications`, `insights`, `shared`. Separate controllers, DTOs, services, and persistence; return DTOs. Use transactions, validated domain operations, and optimistic locking with useful conflict messages.

## Functional contract

### Accounts and projects

- Register, login, logout, session restoration on refresh; normalize emails, reject duplicates, validate inputs, never expose password hashes.
- Projects: name, description, optional deadline, timezone (default `Asia/Kolkata`). Creator becomes manager.
- Project-specific `MANAGER`/`DEVELOPER` roles; a user may have different roles across projects.
- Managers edit project settings and manage memberships/invitations. Invite existing accounts by email through in-app invitations; accept/decline, with membership only after acceptance. No email provider required. Protect the final manager from removal/demotion.
- Both roles create, assign, update work and comment; only managers delete work items. Authors edit/delete their comments; managers may delete comments.
- Enforce current membership/role server-side on every resource, including guessed IDs and AI endpoints. Nonmembers see no project data except minimal invitation details intended for them.

### Work items

- Shared fields: title, description, project, type, optional assignee, priority, status, optional deadline, creator, timestamps, version.
- Types: `TASK`, `BUG`. Priorities: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- Statuses: `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`; allow all transitions among these, including reopening; reject invalid values and record changes.
- BUG fields: severity (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), reproduction steps, expected/actual behavior, category (`UI`, `BACKEND`, `DATABASE`, `AUTHENTICATION`, `PERFORMANCE`, `OTHER`).
- Implement create/read/edit/delete, assignment, status board, and searchable/paginated list. Filter by assignee, type, priority, status, overdue; stable sorting and bounded page sizes. Provide keyboard-accessible status changes even with drag/drop.
- Assignees must be active project members. Removing a member revokes access and transactionally unassigns their open work, recording activity.
- Open = not DONE. Overdue = open with deadline before today's project date. Use date-only deadlines and UTC event timestamps.

### Discussion, notifications, dashboard

- Persist comments and safely render user content.
- Notify assignees on assignment and relevant participants on comments/status changes. Define recipients in README; deduplicate and exclude the actor. Provide unread counts, links, and mark-read; only recipients access their notifications. Links recheck permissions. Polling suffices.
- Activity records: actor, event, related record, timestamp, old/new values for membership, assignment, priority, status.
- Dashboard: task/bug totals, status counts, completion percentage, overdue items, open bugs by severity, open workload/member. Completion = 100 × DONE/all items; empty project = 0%. Calculate from the database.
- Include project switching, mobile/desktop layouts, labels, visible focus, empty/loading/error states, validation, and useful forbidden/not-found/network errors.

## AI contract

Implement configurable `AiAssistantService` providers: a real API adapter and local fallback. Set timeouts, bounded retries/input/output, per-user limits, and server-side response validation. Treat submitted content as untrusted data; AI gets no tools or write authority.

1. **Bug category:** user-triggered suggestion from title/description/reproduction steps; return an allowed category and short explanation. Display separately; persist only on authorized user acceptance. No unsupported accuracy/confidence claims.
2. **Project summary:** Java/SQL computes counts, overdue items, recent completions, unresolved bugs first. Send only necessary selected-project facts/titles; exclude emails, secrets, sessions, and unrelated records. Show a concise AI-labeled summary, generation time, and factual metrics for comparison.
3. **No key/failure:** core works without AI credentials. Label deterministic output **Local rule-based suggestion** / **Local factual summary**. Handle missing config, timeout, rate limit, and invalid output without data loss or automatic edits. Test-only providers stay out of production. Report live-provider verification separately; fallback success is not live-AI verification.

## Data, API, and OOP

Persist `User`, `Project`, `ProjectMember`, `ProjectInvitation`, `WorkItem`, `BugDetails`, `Comment`, `Notification`, `ActivityEvent`. Enforce foreign keys, email/membership uniqueness, indexes, deliberate deletes, and BUG-only details. Use Flyway, not automatic runtime schema updates.

Provide documented REST operations under `/api` for auth/CSRF/current user; projects/members/invitations and recipient responses; work items/comments; notifications; dashboards/activity; category suggestions/summaries. Project collections are membership-scoped. Use appropriate HTTP codes and consistent validation errors. Derive actor/permissions/recipients server-side; never trust client roles, ownership, or metrics.

Demonstrate encapsulation through domain rules, abstraction/interfaces through services, polymorphism through AI providers, composition through membership roles, and justified inheritance (e.g. audited base entity). Explain actual source examples; do not create artificial user subclasses for roles.

## Build order

1. Inspect tooling; choose isolated ports/Compose name. Scaffold wrappers, lockfile, migrations, configuration, health checks; verify database/API readiness.
2. Complete register → login → create project → invite → accept with two accounts in the browser.
3. Complete tasks/bugs, assignments, statuses, permissions, comments.
4. Add notifications, activity, dashboard, filtering, responsive UI.
5. Add AI adapters/fallback and failure handling.
6. Run verification below, fix failures, rerun affected checks, finish deliverables. Do not leave broken core workflows behind.

## Verification gates

Provide a repeatable verification entry point. Check exit codes, assertions, and test totals; compilation, HTTP 200, screenshots, or mocks alone do not prove success.

- **Backend:** Maven Wrapper clean verification including actual unit and Testcontainers MySQL integration execution; detect skipped integration tests.
- **Frontend:** install from lockfile, typecheck, lint, relevant tests, production build.
- **Runtime:** validate Compose, build/start isolated test installation, await readiness, inspect frontend/API/database logs. Separate test data/credentials from existing installations; cleanup only disposable test resources.
- **Browser/API:** Playwright with real frontend/backend/MySQL and separate manager/developer contexts; direct API negative checks, outsider account, two projects, controlled clock for date boundaries. Assert persisted outcomes, not clicks alone.

| ID | Required scenario and result |
| --- | --- |
| A01 | Register 3 accounts; duplicate rejected; login/refresh work; logout invalidates session. |
| A02 | Create project, invite/accept; both members see correct project and roles. |
| A03 | Developer manager-only actions and outsider guessed project/item/comment IDs denied; no data changes. |
| A04 | Create/assign/reprioritize/transition task; board, details, database, activity agree. |
| A05 | Create/edit/reopen bug; bug details persist and metrics update. |
| A06 | Comments/assignment/status notifications reach correct recipients; counts/links/read state work; private access denied. |
| A07 | Known fixtures independently verify every dashboard metric, including empty project and deadline boundaries. |
| A08 | Search/filter/pagination/empty results return correct items/counts in stable order. |
| A09 | Refresh and stop/start without deleting volumes preserve accounts, work, comments, notification read state. |
| A10 | Category suggestion requires acceptance; summary shows correct metrics, timestamp, provider label. |
| A11 | Test-provider timeout/malformed output/rate limit yields useful error/fallback, no lost data or silent edits. |
| A12 | Removal revokes membership and unassigns open work; cross-project assignment rejected; final manager protected; stale edit conflicts. |
| A13 | Invalid/missing CSRF rejected; others' notifications denied; script-like comments cannot execute. |
| A14 | Desktop/mobile and keyboard inspection: readable UI, visible focus, usable status controls, no blocking overflow. |

## Deliverables and completion

Inside the DevSync root provide:

- Source, migrations, wrappers, lockfile, Compose, `.env.example`, tests, verification entry point.
- `README.md`: exact PowerShell-friendly setup/start/stop/verify commands, URLs, prerequisites/versions, configuration, troubleshooting, notification rules, no-key mode.
- Repeatable fictional demo data with two project roles; development-only seeding/credentials, disabled by default in production.
- `docs/ARCHITECTURE.md`: modules, relationships, permissions, AI flow, source-backed OOP examples. `docs/DEMO.md`: short manager/developer walkthrough.
- Concise `BUILD_STATUS.md`; `VERIFICATION.md` with date, commands, versions, exit codes, test totals, A01–A14 results, artifact paths. Use PASS/FAIL/BLOCKED/NOT RUN; explain nonpasses and next actions.
- Browser report and board/bug/dashboard/AI screenshots in `artifacts/verification/`; exclude secrets/private data. Reference evidence instead of duplicating logs across documents.

Claim working only after build, database, permissions, persistence, and browser acceptance gates pass. State unavailable tooling/credentials and unverified checks honestly; live AI has a separate result. Handoff: what works, exact start command, URL, test outcome, blockers, and stop command. Leave the authorized local demo running when feasible.
