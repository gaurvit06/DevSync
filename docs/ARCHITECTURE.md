# Architecture and Java OOP

Browser → React/Vite (or Nginx static production build) → same-origin `/api` → Spring controllers → transactional services → JPA repositories → MySQL. Flyway V1 owns the schema; Hibernate validates it. A separate backend HTTP adapter calls the optional AI provider. It has no tools or database-write access.

## Modules and source map

- `identity`: AuthController/AuthService, SecurityConfig, User. BCrypt, email normalization, server sessions, CSRF, session-ID rotation on login.
- `projects`: WorkspaceController and WorkspaceService coordinate projects, memberships, invitations, dashboard metrics, activity, and work-item transactions.
- `workitems`: WorkItem/BugDetails and repositories; versioned updates return conflicts instead of silent overwrites.
- `discussion` / `notifications`: persisted comments and recipient-scoped notifications.
- `insights`: InsightController/InsightService authorize and rate-limit requests; AiAssistantService is implemented by LocalAiProvider and ApiAiProvider.
- `shared`: AuditedEntity and consistent API exception handling.

The service is intentionally compact for a three-member student team. Extract dedicated work-item/notification services when scope grows; retain transactional business rules rather than moving them into the UI. Entity fields are currently internal persistence fields; controllers return explicit DTO maps and never serialize User/passwordHash. Public request payloads are validated in auth DTOs and service domain operations.

## Relationships

User has many ProjectMember records; `(project_id,user_id)` is unique. A Project has members, invitations, WorkItems, and ActivityEvents. ProjectInvitation targets a registered recipient and has a response status. WorkItem has one optional BugDetails record (BUG only), many Comments, and related Notifications. Comments have authors; notifications have recipients. Audit timestamps are inherited; work-item `version` implements optimistic locking. Foreign keys/indexes/delete cascades are in `backend/src/main/resources/db/migration/V1__schema.sql`.

Deleting work removes its dependent comments, bug details, notifications, and linked activity rows; a separate ITEM_DELETED event retains the title. Removing members preserves their historical completed assignments and authored comments. Active assignees and all request access are checked against current membership.

## OOP examples

| Concept | Actual implementation |
| --- | --- |
| Encapsulation | WorkspaceService keeps repositories private and enforces final-manager, assignee, membership, status, and conflict rules through operations. |
| Abstraction/interfaces | AiAssistantService defines category/summary operations independently of provider details; JPA repositories abstract persistence. |
| Polymorphism | LocalAiProvider and ApiAiProvider satisfy the same interface; InsightService selects configured behavior and fallback. |
| Inheritance | Persistent entities extend shared AuditedEntity for generated identity and timestamps. |
| Composition | ProjectMember associates users, projects, and per-project roles; BugDetails supplements a shared WorkItem. |

## API

All routes below start `/api`; mutations require the CSRF token returned by GET `/auth/csrf` in `X-XSRF-TOKEN`, plus the session cookie. Login rotates an existing session ID; logout invalidates it. Unauthenticated requests return 401, forbidden operations 403, missing records 404, conflicts 409, invalid input 400, and AI limits 429.

| Route | Methods/operation |
| --- | --- |
| `/auth/register`, `/auth/login`, `/auth/logout` | POST |
| `/auth/me`, `/auth/csrf` | GET |
| `/projects` | GET accessible projects, POST create |
| `/portfolio` | GET development and bug counts for projects the user belongs to |
| `/projects/{p}` | PUT settings (manager) |
| `/projects/{p}/members` | GET |
| `/projects/{p}/members/{userId}` | PUT role, DELETE membership |
| `/projects/{p}/invitations` | GET pending invitations, POST recipient email (manager) |
| `/invitations`, `/invitations/{id}/respond` | GET inbox, POST `{accept:boolean}` |
| `/projects/{p}/work-items` | GET filters/page/size, POST create |
| `/work-items/{id}` | GET, PUT full DTO including version, DELETE |
| `/work-items/{id}/comments` | GET, POST content |
| `/comments/{id}` | PUT content, DELETE |
| `/notifications`, `/notifications/unread-count`, `/notifications/{id}/read` | GET newest 100, GET exact unread count, POST mark-read |
| `/projects/{p}/dashboard`, `/projects/{p}/activity` | GET metrics for members, GET paginated activity (`page`) for project managers |
| `/work-items/{id}/ai/category`, `/projects/{p}/ai/summary` | POST |
| `/projects/{p}/messages` | GET newest messages or earlier messages with `before`, POST message content |
| `/direct-messages`, `/direct-messages/{recipient}` | GET eligible teammates and recent conversations, GET a two-person thread, POST a message to a teammate |
| `/projects/{p}/snippets`, `/projects/{p}/snippets/{id}` | GET paginated title search, POST create, PUT versioned edit, DELETE |
| `/projects/{p}/call`, `/projects/{p}/call/{action}` | GET room availability, POST join, sync, signal, leave |
| `/direct-messages/{recipient}/call`, `/direct-messages/{recipient}/call/{action}` | Same call operations for the authenticated user and the named teammate |

Work filters: `q`, `type`, `priority`, `status`, `assigneeId`, `overdue=true`; `page` starts at 0 and `size` is clamped 1–100. Sort is descending ID. Current student-scale implementation loads project work before applying filters/aggregations; migrate these to indexed SQL queries for larger deployments.

## Project chat and calls

MySQL stores project messages and their authors. The chat service checks project membership for reads and writes. The message view polls while visible and loads up to 40 older messages at a time.

Direct messages use a separate MySQL table keyed by a canonical user pair. The server derives one participant from the authenticated session. At least one shared project is required to send. Existing conversations remain readable by their two participants if the shared membership ends.

Project chat message views include the author's current project role. Direct message views include both participants' roles through their respective messages only when both belong to the optional selected `project`.

The call service keeps temporary rooms keyed by project or by an authenticated user pair. Group calls require project membership and allow up to four participants. Direct calls require a shared project and allow only the two participants. Each join gets a new session ID, and signals address a specific active peer session. A short lease removes abandoned sessions. Calls end when the API restarts.

Browsers exchange streams over WebRTC. The peers reserve audio and video slots when they connect, so toggling cameras or switching to a shared screen can replace a track. Group and direct calls share the media implementation. Each call appears beside its own chat history.

## AI data and verification

Bug input is bounded title/description/reproduction steps. Summary input is counts, recent completed titles, and unresolved bug titles from one authorized project. No user emails, session secrets, or unrelated records are sent. The provider returns bounded, validated structured output, with explicit fallback labels and user-controlled acceptance. Summary prose is not a mechanically verified fact; compare it with the included metrics.

Tests include real MySQL through Testcontainers, HTTP-stub provider response validation, and browser workflows against an independent MySQL installation. See VERIFICATION.md for coverage; test substitutes are confined to tests.
