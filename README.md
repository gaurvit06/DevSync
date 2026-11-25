# DevSync

**An AI-assisted workspace where developer teams manage projects, tasks, bugs, chat and calls in one place.**

[Hosted demo](https://devsync-woad-seven.vercel.app/) · Java 21 · Spring Boot 3.5 · React 19 · MySQL 8.4

<!-- Add screenshots here: task board, bug page with the AI suggestion, and a group call.
     Suggested path: docs/images/board.png, docs/images/bug-ai.png, docs/images/call.png -->

## Why DevSync

Student and small teams often run on a chat group for tasks, a spreadsheet for bugs and memory for deadlines. DevSync puts the project board, bug tracker, team chat, calls and a small AI helper in one app, so everyone sees the same picture.

## Features

- **Projects and roles:** create projects, invite members by email, and give each member a Manager or Developer role per project.
- **Tasks and bugs:** one work-item model with status, priority, assignee, deadline and an optional pull request link. Bugs add severity, steps and a category. Filters and a board view are included.
- **Comments and notifications:** discuss work items and get notified on assignment, status changes and comments.
- **Chat:** a group chat for each project and direct messages between teammates.
- **Calls:** voice and video calls with microphone, camera and screen sharing. Up to four people per group call, peer to peer.
- **Snippets:** a shared library of commands, queries and code examples, with search and copy.
- **Dashboard and activity:** progress, overdue work and an activity feed for managers.
- **AI assistance:** bug category suggestions and project summaries. Suggestions never change anything until a person accepts them.

## Tech stack

| Layer | Technology |
| --- | --- |
| Backend | Java 21, Spring Boot 3.5 (Web, Data JPA, Security, Validation, Actuator), Maven |
| Database | MySQL 8.4, Flyway migrations |
| Frontend | React 19, TypeScript, Vite, Bootstrap 5, lucide-react |
| Security | Server sessions, BCrypt, CSRF tokens, HttpOnly SameSite cookies |
| Calls | WebRTC (peer to peer), signalling relayed by the Spring server |
| AI | OpenAI-compatible chat API, with a built-in local-rules fallback |
| Testing | JUnit 5, Testcontainers, Vitest, ESLint, Playwright |
| Delivery | Docker Compose, Nginx; hosted on Vercel (frontend) and Railway (API and database) |

## Architecture

```
Browser → React (Vite / Nginx) → /api → Spring controllers
        → transactional services → JPA repositories → MySQL
                        └→ AiAssistantService → local rules or external AI API
```

The backend is split into modules: `identity`, `projects`, `workitems`, `discussion`, `notifications`, `insights`, `chat`, `calls`, `developer` and `shared`. Flyway owns the schema and Hibernate only validates it. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the schema, API routes and the Java OOP examples.

## Quick start

Requires Docker Desktop (Linux containers), Git and PowerShell.

```powershell
git clone https://github.com/gaurvit06/DevSync.git
cd DevSync
Copy-Item .env.example .env
docker compose up -d --build --wait
```

Open http://127.0.0.1:5186. The API runs on port 8086 and MySQL on loopback port 3308.

To load fictional demo data (needs Node and the frontend dependencies):

```powershell
npm.cmd --prefix frontend ci
node scripts/seed-demo.mjs
```

Demo accounts (development only, created by the seed script):

| Role | Email | Password |
| --- | --- | --- |
| Project manager | manager@devsync.test | DevSyncDemo123! |
| Developer | developer@devsync.test | DevSyncDemo123! |

Stop with `docker compose stop`. Do not use `docker compose down -v` unless you want to delete the data.

For local development without Compose (JDK 21, Node 22.12+, PowerShell 7):

```powershell
./scripts/Start-Local.ps1
node scripts/seed-demo.mjs
./scripts/Stop-Local.ps1
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD` | MySQL connection |
| `MYSQL_ROOT_PASSWORD` | MySQL root password (Compose) |
| `PORT` | API port (default 8086) |
| `COOKIE_SECURE` | Set `true` under HTTPS |
| `AI_API_KEY` | Enables the real AI provider. Without it, local rules are used |
| `AI_MODEL`, `AI_API_URL` | Model name and endpoint (defaults: `gpt-4.1-mini`, OpenAI chat completions) |
| `CALL_ICE_URLS`, `CALL_TURN_USERNAME`, `CALL_TURN_CREDENTIAL` | Optional ICE and TURN settings for calls across restrictive networks |

Never put keys in frontend variables and never commit `.env`.

## How the AI works

- **Bug category:** open a bug and click **Suggest category**. You get a category (such as authentication, database, performance, UI or backend), a rationale and a next debugging check.
- **Project summary:** open **AI tools** and click **Generate summary** for a briefing with progress and links to work that needs attention. Counts come from database queries. The AI only turns selected facts into prose.
- **No key, or the call fails:** clearly labelled local rules take over, so the feature always works.
- **Safeguards:** requests are scoped to project members, limited to ten per user per minute, and never change a bug until accepted.

## Testing

```powershell
./scripts/Verify.ps1                          # full run: backend, frontend, browser, persistence
./backend/mvnw.cmd -f backend/pom.xml clean verify
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run test:e2e
```

Backend integration tests run against a disposable MySQL through Testcontainers. Browser tests use Playwright on separate ports (5187, 8087, 3309).

## Project structure

```
backend/    Spring Boot API (Java 21)
frontend/   React + TypeScript app
docs/       ARCHITECTURE.md, DEMO.md
scripts/    PowerShell and Node helpers: start, stop, verify, seed
compose.yaml, compose.acceptance.yaml, .env.example
```

## Known limitations and roadmap

- Work-item filters and dashboard counts load a project's work first and filter in code. Moving them to indexed SQL queries is the next step for larger deployments.
- Chat and notifications use polling, not WebSockets.
- Calls end when the API restarts. TURN may be needed on networks that block direct connections.
- Ideas for later: deeper GitHub integration (pull request status), AI priority and task-description suggestions, AI code review suggestions, sprint planning and workload prediction, Slack integration.

## Team

BE (CSE) college project. Faculty guide: Mrs. Cheenu.

- Gaurvit Joshi
- Mehak Sharma
- Pratham Panesar

## License

<!-- Choose a license (for example MIT) and add a LICENSE file, then name it here. -->
