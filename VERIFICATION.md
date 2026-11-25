# Verification record

Date: 2026-11-24, Asia/Kolkata. Local-only delivery. Actual agent token usage is unavailable.

## Environment and isolation

Windows/PowerShell; Temurin JDK 21.0.13.1, Maven Wrapper 3.9.9, Node 26.13.0, Docker Engine 29.9.2, MySQL 8.4.13. React 19.2.0, TypeScript 5.9.3, Vite 7.3.8, Vitest 4.1.12, Playwright 1.56.1 with installed Chrome. Spring Boot 3.5.16. See lockfile and pom for exact dependencies.

Backend integration uses disposable Testcontainers MySQL, not H2. Browser acceptance uses its own Compose project/volume (`devsync-acceptance`) and ports 5187/8087/3309. The seeded user demo uses `devsync` and 5186/8086/3308. No Casework data or service volumes were changed.

## Executed checks

| Command/check | Result | Evidence |
| --- | --- | --- |
| `backend/mvnw.cmd -B -f backend/pom.xml clean verify` with JAVA_HOME=local JDK21 and DOCKER_API_VERSION=1.44 | PASS, exit 0; 13 tests, 0 failures/errors/skips | `artifacts/verification/backend-tests.log`; `backend/target/surefire-reports/TEST-*.xml` |
| `npm.cmd run typecheck` and `npm.cmd run lint` from frontend | PASS, exit 0 | Executed against final application source; rerun commands in README |
| `npm.cmd test` from frontend | PASS, exit 0; 1 unit test | Vitest output; behavior acceptance primarily comes from backend/browser tests |
| `npm.cmd run build` from frontend | PASS, exit 0; TypeScript and production bundle | `artifacts/verification/frontend-build.log`, `frontend/dist/` |
| `npm.cmd run test:e2e` from frontend | PASS, exit 0; 1 integrated multi-account browser workflow, no skips | `artifacts/verification/browser.log`, `browser-results.json`, `frontend/playwright-report/` |
| Stop/start acceptance API, Vite, and MySQL, then `node scripts/check-persistence.mjs` | PASS, exit 0 | `artifacts/verification/persistence-result.json` |
| `npm.cmd audit --json` from frontend | PASS, exit 0; 0 reported vulnerabilities, including dev dependencies | `artifacts/verification/npm-audit-final.json` |
| `docker compose config -q` | PASS, exit 0 | Compose configuration validated |
| `docker compose build` and `docker compose up -d --wait` | PASS, exit 0; API and database healthy, frontend serving | `artifacts/verification/compose-build-final.log`, `compose-start.log`, `compose-status.json` |
| `node scripts/smoke-demo.mjs` against full Compose | PASS, exit 0; login, eight persisted demo items, board and bug details, no browser page errors | `artifacts/verification/production-smoke.json`, `demo-overview.png` |
| `scripts/Verify.ps1 -SkipImageBuild` (image build separately verified above) | PASS, exit 0; clean install, checks, browser, restart, cleanup | `artifacts/verification/verify-entrypoint.log` |
| Real external AI provider with actual credentials | NOT RUN | No API key supplied; live-model behavior remains unverified |

## Acceptance mapping

| ID | Result | Actual coverage |
| --- | --- | --- |
| A01 | PASS | Register/login, duplicate normalized email, reload, logout invalidation; backend/browser |
| A02 | PASS | In-app invitation acceptance/decline, project visibility, manager/developer roles |
| A03 | PASS | Guessed IDs rejected, manager-only changes/deletion denied, persisted state preserved |
| A04 | PASS | Task creation, assignment, reprioritization, all status transitions/reopening, activity, browser board |
| A05 | PASS | Bug-specific details, editing/reopening, severity metrics, persisted category |
| A06 | PASS | Comments, notification recipients, private mark-read, exact unread count, permissions |
| A07 | PASS | Independently specified fixture metrics, empty project, controlled-clock date boundary |
| A08 | PASS | Type/search filters, stable pagination, empty results; browser search |
| A09 | PASS | Account/items/comments/notification read state survive service and database restart |
| A10 | PASS (local) | Labeled suggestions, explicit acceptance, summary metrics/time; unauthorized AI requests denied |
| A11 | PASS (simulated) | Provider error fallback, rate-limit enforcement; HTTP-stub response validation and invalid JSON/category/429 rejection |
| A12 | PASS | Invalid assignee rejected, final-manager safeguards, removal/unassignment/revoked access, stale version conflict |
| A13 | PASS | Missing CSRF rejection, private notifications, validation, browser renders script-like comments as text |
| A14 | PASS | 1440px desktop/390px mobile screenshots inspected, keyboard-selectable statuses, no document overflow |

Screenshots: `artifacts/verification/board.png`, `bug.png`, `dashboard-ai.png`, `mobile-board.png`, `demo-overview.png`. Board scrolling is contained on mobile. Exact host/browser versions are also recorded in `artifacts/verification/tool-versions.json`.

## Limits and interpretation

- A passing test confirms its assertions, not every possible input or production-scale behavior. Browser acceptance uses real APIs/database and separate account contexts; core responses are not mocked.
- The real API adapter is tested against a local HTTP stub. Timeout/malformed/rate-limit failures are simulated in tests. These do not establish live-provider success; set a real server-side key and verify separately before claiming that.
- This is a local educational application. Project collections currently aggregate/filter in Java; large-scale performance and hosted deployment are outside the verified scope.
- Initial testing exposed duplicate notifications, transaction-proxy field access, and stale/ambiguous form state. These were corrected before the passing runs. Package verification initially hit a Windows lock on a running target JAR; runtime scripts now use a separate copy.
- Clean-script testing exposed empty environment-variable restoration on Windows; absent values are now removed, database users are explicit, and repeated launches restore the caller's configuration. MySQL readiness checks execute a query as the application user rather than only pinging the server.
- Flyway emits a MySQL-version support advisory in this dependency set; migration/validation succeeds against the actual MySQL 8.4 engine. No compatibility claim for other database versions is made.

Reproduce with `scripts/Verify.ps1`; it preserves demo data and cleans up only its acceptance-mode processes (database volume retained). Review logs rather than interpreting a successful image build or health check alone as application acceptance.

## Developer tools and project calls, 2026-11-24

- Backend verification passed all 15 tests, including the original acceptance suite, review URL validation, snippet permissions, and call room membership and signal isolation. Evidence is in `artifacts/verification/developer-backend.log`.
- The original browser workflow and the new developer workflow both passed locally. The new test used three isolated accounts and synthetic devices. It checked incoming audio tracks, decoded video, the color of an incoming synthetic screen stream, mic and camera controls, navigation during a call, leaving, clipboard copying, and the work item review link. Evidence is in `developer-browser.log`, `developer-browser-current.log`, `project-call.png`, and `project-snippets.png` under `artifacts/verification/`.
- The running Compose app applied Flyway V2 to the existing database. A second browser smoke test against that app saw shared snippets, checked the 320 px layout, and received video between two existing demo accounts. See the screenshots in `artifacts/team-demo/`.
- Real microphones, webcams, desktop picker selection, and calls across separate networks using TURN were outside the automated test. The production app requests media from the browser when a member joins or chooses to share their screen.

## Parallel projects, AI briefing, and meeting chat, 2026-11-25

- Maven verification passed all 16 tests. The new chat case checks message authors, older-message cursors, validation, and isolation across both users and projects. It also checks separate portfolio counts for active tasks and bugs. See `artifacts/verification/parallel-backend.log`.
- Local Compose applied Flyway V3 to the existing database. Three fictional accounts worked in Workshop Registration and Lab Inventory. Both boards contained active development and bug fixes. A briefing linked to an overdue bug, and local triage provided a category, rationale, and next debugging check.
- Two accounts exchanged persisted project messages and connected simulated audio and video. One sent a decision from the chat panel beside the call, and the other received it. The other project retained its own conversation. The meeting chat fit a 390 px mobile viewport. Demo screenshots are in `artifacts/parallel-demo/`.
- Both Playwright workflows passed against the isolated acceptance database. The call test confirmed chat exchange, an uninterrupted call when switching views, the side panel, incoming audio and video, and screen sharing. See `artifacts/verification/parallel-browser.log`.

## Direct messages, 2026-11-25

- All 17 Maven tests passed with MySQL. The direct-message test covers teammate discovery, a two-way thread, paging, third-member and outsider isolation, and read-only history after a shared membership ends. See `artifacts/verification/direct-backend.log`.
- Frontend lint, production build, unit test and both Playwright workflows passed. The browser workflow exercised search, delivery, direct and group separation, and project calling. See `artifacts/verification/direct-browser.log`.
- The running app applied Flyway V4. A localhost demo used three fictional accounts to verify two-way messaging, project switching, and the 390 px layout. Screenshot: `artifacts/parallel-demo/08-direct-messages.png`.

## Manager permissions and role badges, 2026-11-25

- All 17 backend tests passed. They verify manager access to Activity, developer and outsider denials, promotion and demotion, invitation and role-change denials, and project-scoped chat badges. See `artifacts/verification/manager-roles-backend.log`.
- Frontend lint, build, unit test, and both Playwright workflows passed. A local demo switched one account between a project it manages and one where it is a developer. It verified the Activity navigation and chat badges changed with the project. See `artifacts/verification/manager-roles-browser.log` and screenshots `09-manager-activity.png` and `10-chat-role-badges.png` in `artifacts/parallel-demo/`.

## Calls inside conversations, 2026-11-25

- All 18 Maven tests passed. The direct-call test verifies a two-participant room, isolation from other teammates and the project room, scoped signaling, hangup, and membership revocation. See `artifacts/verification/chat-calls-backend.log`.
- Frontend lint, build, and unit tests passed. The running local Compose demo verified group and direct audio/video with fictional accounts and simulated devices. Both views keep their own history and composer beside the call. See `11-group-chat-call.png` and `12-direct-message-call.png` in `artifacts/parallel-demo/`.
- Both Playwright workflows passed. The calling workflow checked direct audio and video, messages sent during both call types, isolation from a third teammate, return from the board, and group screen sharing. Local demo checks also covered a 390 px viewport. See `artifacts/verification/chat-calls-browser.log`, `project-call.png`, and `direct-call.png`.

## Hosted deployment, 2026-11-25

- The Vercel production alias returned HTTP 200 in a fresh client. Its `/api` route issued a Secure CSRF cookie, served noncacheable responses, and returned 401 for an unauthenticated session. Railway readiness returned UP and all four Flyway migrations applied to a private MySQL service.
- Targeted hosted browser and API checks passed for public UI sign-in, HTTP-only Secure session cookies, project data, developer permissions, chat, AI summaries, and call signaling. Two isolated Chromium contexts exchanged simulated audio and video through both call rooms. See `artifacts/verification/vercel-hosted-media.log`.
- The broader browser suite had hosted timing failures around invitation acceptance, mobile focus, and opening a newly created board item during the first runs. The hosted release check separately confirmed a developer's new task appeared on the manager's board with its pull request link. See `artifacts/verification/vercel-hosted-release.log`.
