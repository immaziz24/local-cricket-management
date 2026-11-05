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
| `/api/auth` | User registration, authentication, token refresh, password resets | *Pending source confirmation* |
| `/api/tournaments` | Tournament creation, stages, fixtures, points table calculation | *Pending source confirmation* |
| `/api/teams` | Team registrations, rosters, player profiles, statistics | *Pending source confirmation* |
| `/api/matches` | Match scheduling, playing conditions, toss records, result declarations | *Pending source confirmation* |
| `/api/scoring` | Real-time ball-by-ball recording, commentary logs, player performance metrics | *Pending source confirmation* |
| `/api/category-n` | Dedicated endpoints supporting Phase 1 (Features #254–270) | *Pending source confirmation* |
| `/api/reports` | Administrative reports, exports, tournament summaries | *Pending source confirmation* |

---

## 5. Mocking Strategy for Frontend Development

During the initial frontend-first phases (beginning with Phase 1: Category N, Features #254–270):
1. **Mock Data Providers:** UI components will consume strongly typed TypeScript interfaces / mock JSON fixtures.
2. **Deterministic State:** Mock handlers will simulate loading delays, error states, and optimistic UI updates.
3. **Seamless Swapping:** API services will be designed using repository patterns or custom client hooks, allowing effortless cutover from mock fixtures to live HTTP endpoints during the backend phase.

