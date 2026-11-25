# Build status

Local-only DevSync is implemented under this directory. No GitHub upload/push performed; Casework source preserved.

- Stack: Java 21 / Spring Boot 3.5.16 / Maven Wrapper 3.9.9; React 19.2 + TypeScript; MySQL 8.4/Flyway.
- Running demo: http://127.0.0.1:5186 (API 8086, DB 3308), all three services via Docker Compose. Stop with docker compose stop; restart with docker compose start. Local development scripts are also verified; do not run both modes on the same ports.
- Acceptance: separate ports 5187/8087/3309 and volume; scripts/Start-Local.ps1 -Acceptance. Test services are stopped; data volume retained.
- Implemented: accounts, sessions/CSRF, per-project roles/invitations, tasks/bugs, board/list/filtering, version conflicts, comments, notifications/unread count, activity, dashboards, AI adapter/local fallback, demo seed, docs/scripts.
- Verified: 13 backend tests passed with MySQL Testcontainers, no skips; frontend typecheck/lint/unit/production build; browser workflow passed; persistence survived API/MySQL restart. npm audit: 0 known issues at check time.
- A01–A14 covered across backend/browser/restart evidence; see VERIFICATION.md when finalized.
- Live AI: not verified (no credentials). Local fallback and HTTP-stub adapter validation verified.
- COMPLETE: final source images built; full Compose application healthy; production smoke passed. scripts/Verify.ps1 -SkipImageBuild passed end-to-end, with the image build verified separately. No required local build/verification work remains. Live external AI is the explicitly unverified optional mode.
- Key fixes: service repository encapsulation (transaction-proxy access), duplicate creation notifications, refreshed member list, explicit form labels.
- Commands: scripts/Verify.ps1; scripts/Stop-Local.ps1; use -Acceptance for isolated test mode.
- Token usage unavailable. Actual suite commands/results are saved under artifacts/verification; no word-count proxy is claimed.

## Direct messages, 2026-11-25

- Chat now includes persisted one-to-one conversations between teammates, alongside project messages and calls. Direct chats stay available across project switches. Former teammates can read their existing history and can send again when they share a project.
- The local Compose stack applied Flyway V4 and is healthy. Maven verification passed 17 tests. Frontend lint, build, unit test and both Playwright workflows passed. The localhost demo confirmed a two-way chat and third-account isolation. Acceptance services were stopped after the run. See VERIFICATION.md.

## Project roles, 2026-11-25

- Activity is manager-only in the UI and API. Invitation and member administration checks were reverified. Project chat and meeting chat display project role badges. Direct chat displays roles for the selected project when both people belong to it.
- The local Compose stack is healthy. All 17 backend tests, frontend lint/build/unit checks, and both Playwright workflows passed. The Release Crew demo verified permission changes and badge changes when the same account switched projects. Acceptance services were stopped after verification.

## Calls inside conversations, 2026-11-25

- Group calls appear alongside the selected project's group chat. Private voice and video calls appear alongside the selected teammate's direct messages. Both retain a route back to the conversation during a call, and direct calls end for both participants on hangup.
- The local Compose stack is healthy. All 18 backend tests, frontend lint/build/unit checks, and both Playwright workflows passed. The localhost demo exercised both views with simulated media, including a 390 px viewport. Acceptance services were stopped after verification.

## Hosted deployment, 2026-11-25

- Vercel Hobby serves the React build and proxies `/api` to the Spring Boot service on Railway. [Hosted DevSync](https://devsync-woad-seven.vercel.app/)
- Railway MySQL is on a private network. Flyway initialized a fresh database through V4. The hosted demo uses its own accounts and projects.
- The hosted smoke checks passed for sign-in, secure cookies, projects and tasks, invitations, permissions, chats, AI summaries, and simulated audio and video in both call types. See `VERIFICATION.md`.
