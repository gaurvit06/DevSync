# DevSync

A local-first Java project for development teams: projects, invitations, task boards, bug reports, comments, notifications, activity, factual dashboards, and optional AI assistance. React/TypeScript frontend, Spring Boot modular backend, MySQL/Flyway storage. Nothing has been published to GitHub.

## Open the local app

Open http://127.0.0.1:5186 after starting the application. Development-only demonstration accounts:

| Role | Email | Password |
| --- | --- | --- |
| Project manager | manager@devsync.test | DevSyncDemo123! |
| Developer | developer@devsync.test | DevSyncDemo123! |

These fictional accounts are created only by explicitly running the demo seed script. Change `DEMO_PASSWORD` before initial seeding if desired. Normal registrations use passwords you choose.

## Start with Docker

Requires Docker Desktop with Linux containers, Git, and PowerShell. From this folder:

```powershell
Copy-Item .env.example .env # first setup only; edit local values if needed
docker compose up -d --build --wait
# Optional fictional demo data: requires Node and frontend npm dependencies
npm.cmd --prefix frontend ci
node scripts/seed-demo.mjs
```

The frontend is on 5186, API on 8086, MySQL on loopback 3308. Stop with `docker compose stop`; restart with `docker compose start`. Volumes preserve data. Do not use `down -v` unless deliberately deleting this project's data. Separate `devsync-acceptance` storage is used for browser tests.

## Local development

Requires JDK 21 (`JAVA_HOME`), Node 22.12+ or a compatible newer version, Chrome, Docker Desktop, and PowerShell 7. The current checkout has an ignored JDK and Maven installation under `.tools`; Maven Wrapper downloads Maven 3.9.9 on another machine. Tested here with Temurin 21.0.13.1, Node 26.13.0, Docker 29.9.2, MySQL 8.4.13.

```powershell
./scripts/Start-Local.ps1
node scripts/seed-demo.mjs
./scripts/Stop-Local.ps1
```

Use `-Rebuild` after backend source changes. Vite reloads frontend changes. Do not run the full Compose app and local scripts on the same ports at once. Local logs and process records are in `.local/demo/`; readiness is `/actuator/health/readiness` on the API port. A separate runtime copy of the JAR prevents Windows file locks from breaking later builds.

For manual terminals: start the Compose database, run `backend/mvnw.cmd -f backend/pom.xml spring-boot:run`, and `npm.cmd --prefix frontend run dev`. The frontend proxies `/api` to 8086. Local scripts read supported `.env` settings unless already set in the environment and restore the caller's environment afterward; Compose also reads `.env`. Manual Maven terminals need configuration exported to their environment. Start Docker Desktop if its engine cannot be reached. If a port is busy, stop its owning DevSync mode rather than terminating unknown processes.

## Verification

```powershell
./scripts/Verify.ps1
```

This stops script-managed local servers before a clean dependency install, builds container images, runs backend tests against disposable Testcontainers MySQL, frontend checks/build, browser acceptance on separate ports 5187/8087/3309, and a stop/start persistence check. Stop the full Compose API/web first if running those instead. Demo data is preserved; restart the demo afterward. Chrome runs with fresh automated contexts, not your personal browser profile. To use installed Playwright Chromium instead, set `$env:PLAYWRIGHT_CHANNEL='chromium'` and install it with `npx playwright install chromium` from `frontend`.

Individual commands:

```powershell
./backend/mvnw.cmd -f backend/pom.xml clean verify
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
./scripts/Start-Local.ps1 -Acceptance
npm.cmd --prefix frontend run test:e2e
./scripts/Stop-Local.ps1 -Acceptance
```

See `VERIFICATION.md` for actual results and limitations. Playwright reports are in `frontend/playwright-report/`; screenshots and command evidence are in `artifacts/verification/`. Building images skips tests; it is not a replacement for verification.

## Calls and developer tools

- **Projects** compares development tasks, bugs being fixed, reviews, and overdue work across your projects. Open any project board directly from that view.
- **Activity** is available to managers of the selected project. Managers also handle invitations, role changes, and member removal under **Team**. Developers can see their team roster, boards, and work progress.
- **Chat → Group chat** shows the selected project's conversation and its voice and video controls. Up to four project members can join. Messages stay visible during the call. Another member can click **Project call in progress** to open the group chat and join.
- **Chat → Direct messages** lets you choose a teammate and start a private voice or video call from their thread. The teammate sees the active call in their contact list and can join in the thread. Either participant can end the two-person call. Messages and history remain available while calling. Role badges use the selected project when both people belong to it.
- Both call types support microphone, camera, and screen sharing. You can open the board during a call and use **Return to call** or **Return to direct call** to return to the conversation. Only one call can use a browser tab at a time.
- **Snippets** lets the team share short commands, queries, and source examples. Search by title, copy code with its original formatting, and edit your own snippets. Managers can remove snippets. Code is displayed as text.
- **Pull request URL** is an optional field when creating or editing a work item. Team members can open the review link directly from the item's details.

### Try a local call

1. Open the same local DevSync URL in two separate browser profiles and sign in as two members of one project.
2. In **Chat → Group chat**, start a voice or video call in the first profile. For a private call, open the teammate's thread under **Direct messages**. Join from the other profile and grant the media permissions for the devices you want to use.
3. Use headphones to avoid feedback when testing two sessions on the same computer. Use **Leave call** in both profiles when finished.

Browser media works on localhost and on a trusted HTTPS origin. For separate devices, both browsers need to reach the same DevSync deployment. Configure the backend's optional `CALL_ICE_URLS` and, for a TURN relay, `CALL_TURN_USERNAME` and `CALL_TURN_CREDENTIAL`. The values are shared with authorized participants during join, so use relay credentials intended for browsers. TURN may be required on networks that block direct connections. Local calls use direct browser connections by default. Calls are ephemeral and use peer-to-peer media. The DevSync server relays signaling and does not record the call.

## Hosted demo

DevSync is deployed on Vercel with a Spring Boot API and a separate MySQL database on Railway. Create an account on the hosted site to use it. [Open the hosted demo](https://devsync-woad-seven.vercel.app/)

Run the Dockerized Spring Boot API as one instance with a fresh MySQL database on a private network. Set `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`, `COOKIE_SECURE=true`, and `SERVER_FORWARD_HEADERS_STRATEGY=framework` on the API service. Its readiness endpoint is `/actuator/health/readiness`.

From the project root, run `scripts/New-VercelPackage.ps1 -ApiOrigin <hosted-https-origin>` to build the frontend and generate an isolated Vercel upload directory. Its rewrite forwards browser requests under `/api` to the hosted API. The package includes the frontend build and routing configuration, so the remote browser can use same-origin session cookies. If the API host sleeps or restarts, users may need to sign in again and rejoin active calls.

## AI and configuration

Open **AI tools** in the workspace navigation. **Generate summary** creates a project briefing with progress, completed work, and direct links to work that needs attention. Choose **Browse bugs**, open a bug, and click **Suggest category** for a category, its rationale, and a next debugging check. The briefing is also available from Overview.

Without credentials, category suggestions and summaries use explicitly labeled local rules/facts. This is the default, fully usable mode. Set `AI_API_KEY`, optional `AI_MODEL`, and `AI_API_URL` on the backend for the real API adapter. The default adapter uses an OpenAI-compatible chat-completions endpoint with JSON responses. Never place keys in frontend variables or commit `.env`.

Remote requests time out, validate responses, and fall back visibly on failure. AI requests are membership-scoped and limited to ten per user/minute. Suggestions do not change a bug until accepted. Counts come from Java/database queries; an LLM only turns selected facts into prose. Generated summaries should be reviewed against their displayed metrics. Tests with a local HTTP stub do not establish live-provider success.

Configuration: `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`, `MYSQL_ROOT_PASSWORD` (Compose), `PORT`, `COOKIE_SECURE`, and the AI variables. Use secure cookies under HTTPS; local HTTP explicitly defaults to nonsecure cookies. Production deployment needs deployment-specific TLS, secrets, and cookie configuration and is outside this local delivery.

## Permissions and notification rules

Roles belong to project memberships. Managers edit project settings, invite/remove members, change roles, and delete work items. Both roles create/update/assign work and comment. Only authors edit comments; authors/managers delete them. Removing the last manager is forbidden. Removing a member revokes access and unassigns their open work.

To invite someone, open **Team** as a manager and enter the email they used to register on this DevSync instance. The invite appears in their DevSync **Inbox**. After they accept, they can open the project. The Team page shows pending invites.

Assignment notifies the new assignee. Later status changes/comments notify the active creator, assignee, and prior commenters, deduplicated and excluding the actor. Initial creation sends an assignment notification rather than a duplicate status notice. Notifications are private to their recipient; item links recheck current membership. The UI polls every 20 seconds.

Work dates follow each project's timezone (default Asia/Kolkata); event timestamps are UTC. Open means not DONE; overdue excludes today and completed items. Completion is DONE/all, with 0% for an empty project. Board columns reflect the current filtered page, explicitly labeled in the UI.

See `docs/ARCHITECTURE.md` for OOP/schema/API details and `docs/DEMO.md` for a walkthrough.

DevSync's filters and board draw inspiration from [Project Management Dashboard by Nickelfox Design](https://www.figma.com/community/file/1073116958099793906/project-management-dashboard).
