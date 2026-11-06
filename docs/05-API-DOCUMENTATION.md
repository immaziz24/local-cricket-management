# API Documentation: Local Cricket Management Platform

> **Document Status:** Architectural Specification / Deferred  
> **Current API State:** **No API or backend application code exists yet**  
> **Development Directive:** Frontend development comes first; API endpoints deferred  

---

## 1. Overview & Architectural Policy

The **Local Cricket Management Platform** follows a strict **Frontend-First** delivery roadmap:
- All initial iterations focus on constructing UI components, navigational structures, and interactive states using client-side mock handlers.
- **No Backend Code Implemented:** No server framework, REST endpoints, GraphQL schemas, or WebSocket services have been authored or deployed.
- **Contract-First Transition:** Once frontend workflows are established and validated, API specifications will be finalized to replace mock providers with production network endpoints.

---

## 2. Infrastructure & Hosting Context

- **Current Environment Address:** `https://localcricket.plateria.in/` *(Temporary starting address)*.
- **Production Target:** Hostinger environment.
- **Hostinger Compatibility Inspection Required:**  
  The API architecture depends on the hosting capabilities supported by the Hostinger subscription:
  - Support for persistent Node.js / Python daemon processes vs serverless endpoints vs standard PHP runtime.
  - WebSocket support for real-time live match ball-by-ball updates.
  - Rate limiting, reverse proxy configurations (Nginx / Apache), and SSL termination.
  - CORS policies and edge routing.

---

## 3. Pending Technical Decisions

| Topic | Considerations | Status |
| :--- | :--- | :--- |
| **API Paradigm** | RESTful JSON API vs GraphQL vs tRPC | **Pending Stack Finalization** |
| **Backend Runtime** | Node.js (Express / Fastify / Next.js API) vs Python vs PHP | **Pending Evaluation & Hostinger Inspection** |
| **Real-time Protocol** | WebSockets vs Server-Sent Events (SSE) vs Polling for live scoreboards | **Pending Architecture Review** |
| **Authentication & AuthZ** | JWT, OAuth 2.0, Session Cookies, Role-Based Access Control (RBAC) | **Pending Security Architecture** |
| **API Versioning** | URI prefixing (`/api/v1/`) vs header versioning | **Pending Design Standard** |

---

## 4. Projected API Domains (Subject to Source Confirmation)

Upon receipt of detailed specifications across all 310 features (17 categories A–Q), endpoints will be grouped into logical domain routers:

| Domain Router | Scope & Functionality | Spec Status |
| :--- | :--- | :--- |
| `/api/auth` | User registration (#254), authentication (#255), token refresh, password resets | **Active Contract Spec (Frontend Mock)** |
| `/api/tournaments` | Tournament creation, stages, fixtures, points table calculation | *Pending source confirmation* |
| `/api/teams` | Team registrations, rosters, player profiles, statistics | *Pending source confirmation* |
| `/api/matches` | Match scheduling, playing conditions, toss records, result declarations | *Pending source confirmation* |
| `/api/scoring` | Real-time ball-by-ball recording, commentary logs, player performance metrics | *Pending source confirmation* |
| `/api/category-n` | Dedicated endpoints supporting Phase 1 (Features #254–270) | *Pending source confirmation* |
| `/api/reports` | Administrative reports, exports, tournament summaries | *Pending source confirmation* |

---

### 4.1 Feature #254 Contract Specification: User Registration (`POST /api/auth/register`)

> **Implementation State:** Frontend mock implemented in `src/services/mock/mockClient.js` via `src/services/dataService.js`. Backend endpoint is deferred. No database or Supabase connection exists.

#### Request Specification
- **Method:** `POST`
- **Path:** `/api/auth/register` (Planned future route)
- **Headers:** `Content-Type: application/json`
- **Request Body (JSON):**
```json
{
  "full_name": "Munna Aziz",
  "email": "munna@example.com",
  "mobile_number": "9876543210",
  "password": "SecurePassword123!",
  "terms_accepted": true
}
```

#### Field Validation Rules
| Field | Type | Required | Constraints |
| :--- | :---: | :---: | :--- |
| `full_name` | String | Yes | Minimum 2 characters after trimming |
| `email` | String | Yes | Valid RFC 5322 email regex; normalized to lowercase |
| `mobile_number` | String | Yes | Standard 10-digit format (numeric digits only) |
| `password` | String | Yes | Minimum 8 characters |
| `terms_accepted` | Boolean | Yes | Must be strictly `true` |

#### Planned Response Schemas
- **Success (`201 Created`):**
```json
{
  "success": true,
  "message": "User registration successful",
  "user": {
    "id": "usr_mock_1730870400000",
    "full_name": "Munna Aziz",
    "email": "munna@example.com",
    "mobile_number": "9876543210",
    "role": "player",
    "created_at": "2026-11-06T03:00:00.000Z"
  }
}
```
- **Client Error (`400 Bad Request`):**
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Please enter a valid email address."
}
```
- **Conflict Error (`409 Conflict`):**
```json
{
  "success": false,
  "error": "Account Already Exists",
  "message": "An account with this email address or mobile number already exists."
}
```

---

### 4.2 Feature #255 Contract Specification: User Login (`POST /api/auth/login`)

> **Implementation State:** Frontend mock implemented in `src/services/mock/mockClient.js` via `src/services/dataService.js`. Connects with registered mock users. Backend endpoint deferred.

#### Request Specification
- **Method:** `POST`
- **Path:** `/api/auth/login`
- **Headers:** `Content-Type: application/json`
- **Request Body (JSON):**
```json
{
  "identifier": "admin@localcricket.com",
  "password": "Password123!",
  "remember_me": true
}
```

#### Field Validation Rules
| Field | Type | Required | Constraints |
| :--- | :---: | :---: | :--- |
| `identifier` | String | Yes | Must be a valid email or 10-digit mobile number |
| `password` | String | Yes | Required password string |
| `remember_me` | Boolean | No | Optional persistence flag (defaults to `false`) |

#### Planned Response Schemas
- **Success (`200 OK`):**
```json
{
  "success": true,
  "token": "mock-jwt-token-1730870400000",
  "user": {
    "id": "usr-1001",
    "full_name": "Munna Aziz",
    "email": "admin@localcricket.com",
    "mobile_number": "9876543210",
    "role": "Platform Administrator"
  }
}
```
- **Authentication Error (`401 Unauthorized`):**
```json
{
  "success": false,
  "error": "Authentication Failed",
  "message": "Incorrect password. Please try again."
}
```
- **Not Found Error (`404 Not Found`):**
```json
{
  "success": false,
  "error": "User Not Found",
  "message": "No account found with this email or mobile number."
}
```

---

### 4.3 Phase 1 Category N Endpoint Directory (#254–270)

All 17 features of Phase 1 are supported in the frontend by the Data Access Layer (`src/services/dataService.js` calling `src/services/mock/mockClient.js`). The projected future REST API endpoints for Phase 1 are:

| Feature # | Feature Name | Planned Method & Endpoint | Purpose | Status in Frontend |
| :---: | :--- | :--- | :--- | :---: |
| **#254** | User registration | `POST /api/auth/register` | User onboarding & validation | Implemented & Verified |
| **#255** | User login and logout | `POST /api/auth/login`, `POST /api/auth/logout` | Session management & credentials auth | Implemented & Verified |
| **#256** | Password recovery | `POST /api/auth/recovery/request`, `POST /api/auth/recovery/reset` | 3-step OTP password reset | Implemented & Verified |
| **#257** | Super-admin dashboard | `GET /api/super-admin/metrics`, `POST /api/super-admin/maintenance` | Platform health & maintenance toggle | Implemented & Verified |
| **#258** | Admin dashboard | `GET /api/admin/queue`, `POST /api/admin/queue/:id/resolve` | Tournament sanction & team approvals | Implemented & Verified |
| **#259** | Organiser permissions | `GET /api/admin/rbac/organiser`, `PUT /api/admin/rbac/organiser` | Organiser capability schemes | Implemented & Verified |
| **#260** | Team owner permissions | `GET /api/admin/rbac/team_owner`, `PUT /api/admin/rbac/team_owner` | Team owner squad rights | Implemented & Verified |
| **#261** | Captain permissions | `GET /api/admin/rbac/captain`, `PUT /api/admin/rbac/captain` | Toss & Playing XI rights | Implemented & Verified |
| **#262** | Scorer permissions | `GET /api/admin/rbac/scorer`, `PUT /api/admin/rbac/scorer` | Scoring & DLS calculation rights | Implemented & Verified |
| **#263** | Umpire permissions | `GET /api/admin/rbac/umpire`, `PUT /api/admin/rbac/umpire` | Match sign-off & misconduct rights | Implemented & Verified |
| **#264** | Player permissions | `GET /api/admin/rbac/player`, `PUT /api/admin/rbac/player` | Personal stats & RSVP rights | Implemented & Verified |
| **#265** | User verification | `GET /api/admin/verifications`, `POST /api/admin/verifications/:id` | Identity document verification queue | Implemented & Verified |
| **#266** | User reporting and suspension | `GET /api/admin/reports`, `POST /api/admin/suspensions` | Disciplinary incident desk & bans | Implemented & Verified |
| **#267** | Activity and audit logs | `GET /api/admin/audit-logs` | Searchable system audit trail & export | Implemented & Verified |
| **#268** | Database backup | `GET /api/admin/backups`, `POST /api/admin/backups/trigger` | Snapshot archives & restore simulation | Implemented & Verified |
| **#269** | Security and privacy management | `GET /api/admin/security`, `PUT /api/admin/security` | 2FA policies & DPDP data export | Implemented & Verified |
| **#270** | Notifications management | `GET /api/admin/notifications`, `POST /api/admin/notifications/dispatch` | Multi-channel broadcast dispatcher | Implemented & Verified |

---

---

## 5. Mocking Strategy for Frontend Development

During the initial frontend-first phases (beginning with Phase 1: Category N, Features #254–270):
1. **Mock Data Providers:** UI components will consume strongly typed TypeScript interfaces / mock JSON fixtures.
2. **Deterministic State:** Mock handlers will simulate loading delays, error states, and optimistic UI updates.
3. **Seamless Swapping:** API services will be designed using repository patterns or custom client hooks, allowing effortless cutover from mock fixtures to live HTTP endpoints during the backend phase.

