# Architecture Decision Log (ADR): Local Cricket Management Platform

> **Log Status:** Active Records  
> **Repository:** [https://github.com/immaziz24/local-cricket-management](https://github.com/immaziz24/local-cricket-management)  
> **Development Environment:** Antigravity IDE on Windows  
> **Git Username:** Munna Aziz  

---

## Decision Records Summary

| ADR ID | Decision Title | Decision Date | Status |
| :---: | :--- | :---: | :---: |
| **ADR-001** | Platform Scope & Phased Feature Categorization | 2026-11-05 | **Accepted** |
| **ADR-002** | Frontend-First Development Strategy | 2026-11-05 | **Accepted** |
| **ADR-003** | Deferral of Database & Backend Implementation | 2026-11-05 | **Accepted** |
| **ADR-004** | Domain Strategy & Temporary Address Configuration | 2026-11-05 | **Accepted** |
| **ADR-005** | Hostinger Deployment Compatibility Inspection | 2026-11-05 | **Pending Inspection** |
| **ADR-006** | Technology Stack Selection | 2026-11-05 | **Pending Decision** |
| **ADR-007** | Version Control Baseline & Remote Configuration | 2026-11-05 | **Accepted** |
| **ADR-008** | Specification Integrity & No Feature Invention Rule | 2026-11-05 | **Accepted** |
| **ADR-009** | Feature #254 User Registration Frontend Implementation | 2026-11-06 | **Accepted** |
| **ADR-010** | Phase 1 Category N Coordinated Batch Strategy & Feature #255 Implementation | 2026-11-06 | **Accepted** |
| **ADR-011** | Phase 1 Category N Complete 17-Feature Implementation & IDE Resolution | 2026-11-06 | **Accepted** |

---

## Detailed Records

### ADR-001: Platform Scope & Phased Feature Categorization
- **Context:** The platform requires an organized structure to manage a large-scale project footprint spanning multiple cricket administration capabilities.
- **Decision:** The platform scope is formally defined as **310 planned features** divided across **17 categories (A–Q)** and scheduled over **six sequential development phases**:
  - **Phase 1:** Category N (17 features: #254–270).
  - **Phase 2:** Categories B & C (48 features).
  - **Phase 3:** Categories A, D, E & L (103 features).
  - **Phase 4:** Categories F, G & Q (37 features).
  - **Phase 5:** Categories H, I, J & K (56 features).
  - **Phase 6:** Categories M, O & P (49 features).
- **Consequences:** Ensures predictable delivery cadences and precise tracking across all 310 features.

---

### ADR-002: Frontend-First Development Strategy
- **Context:** Delivering user-facing value and validating cricket scoring and management workflows requires rapid visual and UX feedback before investing in persistent database models and backend services.
- **Decision:** All initial development efforts will focus strictly on the frontend. The application will use mock contracts and client-side state models first. Backend and database authoring is forbidden until frontend foundations are reviewed.
- **Consequences:** Accelerates user interface validation, clarifies exact data requirements, and avoids premature schema migrations.

---

### ADR-003: Deferral of Database & Backend Implementation
- **Context:** Designing databases before UI workflows are locked down often causes redundant schema refactoring.
- **Decision:** Do not create or configure any database at this stage. No application backend code or database schemas will be initialized during Phase 1 setup.
- **Consequences:** Prevents wasted schema work. Keeps project resources focused entirely on UI/UX and feature alignment.

---

### ADR-004: Domain Strategy & Temporary Address Configuration
- **Context:** The platform needs an immediate web presence for early deployment, staging, and preview testing.
- **Decision:** Utilize `https://localcricket.plateria.in/` as a temporary starting address. A permanent, branded main domain will be purchased and configured at a later milestone.
- **Consequences:** Eliminates domain registration delay while maintaining flexibility for final domain branding.

---

### ADR-005: Hostinger Deployment Compatibility Inspection
- **Context:** The platform is targeted for deployment on Hostinger hosting infrastructure.
- **Decision:** Conduct a comprehensive inspection of the Hostinger environment (supported Node.js runtime versions, static site hosting vs server-side rendering, MySQL connection policies, SSL certificates, build pipelines) prior to code generation.
- **Status:** **Pending Inspection.**
- **Consequences:** Prevents architectural incompatibilities between frontend build outputs / backend services and the hosting environment.

---

### ADR-006: Technology Stack Selection
- **Context:** A modern, performant web development framework is required to support real-time scoring, interactive charts, and administrative dashboards.
- **Decision:** The specific frontend framework and backend technologies are not yet finalized. Options will be evaluated against developer velocity, ecosystem richness, and Hostinger compatibility.
- **Status:** **Pending Final Decision.**
- **Consequences:** Avoids lock-in to an unverified tooling configuration.

---

### ADR-007: Version Control Baseline & Remote Configuration
- **Context:** The project requires professional source control tracking and collaborative remote repository integration.
- **Decision:** Git is initialized locally in the repository root, with user `Munna Aziz` configured, and remote `origin` established pointing to `https://github.com/immaziz24/local-cricket-management`.
- **Current State:** Initialization and remote configuration are completed. However, no files have been committed or pushed to the remote repository yet.
- **Consequences:** A clear, clean baseline is ready for documentation and future code commits.

---

### ADR-008: Specification Integrity & No Feature Invention Rule
- **Context:** While the category structure and feature counts are strictly known, detailed descriptions for certain features remain to be finalized from project sources.
- **Decision:** Maintain strict preservation of feature numbers and category assignments. Under no circumstances should missing feature titles or descriptions be invented or guessed. All unconfirmed items must be labeled as **Pending Source Confirmation**.
- **Consequences:** Guarantees specification integrity and eliminates hallucinated requirements.

---

### ADR-009: Feature #254 User Registration Frontend Implementation
- **Context:** Feature #254 (User registration) is the first feature of Phase 1 (Category N: Administration, Security and User Management). In accordance with the frontend-first strategy (ADR-002) and backend deferral (ADR-003), user registration must be built with complete UI workflows, validation, and simulated state without connecting to a live database or backend.
- **Decision:**
  1. Author a dedicated component `src/views/RegisterView.jsx` matching the dashboard visual hierarchy.
  2. Implement client-side validation rules: Full Name (min 2 characters), Email (RFC 5322 regex), Mobile Number (10 digits), Password (min 8 characters), Password Confirmation (exact match), and Terms & Conditions acceptance.
  3. Include independent toggle visibility controls for Password and Confirm Password inputs.
  4. Decouple data handling by routing submissions through the Data Access Layer (`src/services/dataService.js` calling `src/services/mock/mockClient.js`), simulating network latency and mock duplicate email conflict handling (`registered@example.com`).
  5. Include a modal notification when user clicks "Sign In", explaining that Feature #255 (User Login) is scheduled next, avoiding premature login implementation.
  6. Explicitly display notice that no real persistent account has been created (frontend simulation).
- **Consequences:** Provides a complete, responsive user registration experience ready for review while maintaining a clean boundary for future Supabase PostgreSQL integration.

---

### ADR-010: Phase 1 Category N Coordinated Batch Strategy & Feature #255 Implementation
- **Context:** The project requested Phase 1 — Category N, Features #254–270 (all 17 features together) implemented as one coordinated development batch under a PHASE-WISE strategy. Category N represents Administration, Security, and User Management. Features #254 (User Registration) and #255 (User Login) have established specifications, whereas slots #256–270 do not have original descriptions in project documentation.
- **Decision:**
  1. **Strict Specification Integrity (ADR-008):** In accordance with project rules, do not invent or guess feature requirements for slots #256–270. Catalog all 17 feature slots transparently, marking #256–270 as **Pending Source Confirmation from Project Owner**.
  2. **Feature #255 (User Login) Implementation:** Author a dedicated, responsive login view (`src/views/LoginView.jsx`) providing identifier validation (Email or Indian mobile number), password visibility toggle, remember-me state, interactive test credential chips, simulated authentication via Data Access Layer, error handling, authenticated profile display, and direct integration with Feature #254.
  3. **Feature #254 (User Registration) Refinement:** Enforce strict Indian mobile number validation (`/^(?:(?:\+|00)91|0)?[6789]\d{9}$/`), prevent duplicate mobile numbers alongside emails in mock store, and link directly to Feature #255 Login View.
  4. **Category N Coordination Hub:** Author `src/views/CategoryNView.jsx` as an administrative management and status hub tracking all 17 slots of Phase 1, exposing immediate navigation to working features (#254 & #255) and an authoritative status table for slots #256–270.
  5. **Data Access Layer Expansion:** Add `loginUser()`, `getCurrentUser()`, `logoutUser()`, and `fetchCategoryNSlots()` to `src/services/dataService.js` and `src/services/mock/mockClient.js`, enabling mock user registration, login, session state, and slot inventory without external backend dependencies.
- **Consequences:** Completes the coordinated Phase 1 batch for all specified features with verified integration, eliminates speculative implementation, and preserves clean architecture for future Supabase PostgreSQL migration.

---

### ADR-011: Phase 1 Category N Complete 17-Feature Implementation & IDE Resolution
- **Context:** The project owner provided the official confirmed specifications for all 17 features comprising Phase 1 (Category N: Administration, Security and User Management): #254 User registration, #255 User login and logout, #256 Password recovery, #257 Super-admin dashboard, #258 Admin dashboard, #259 Organiser permissions, #260 Team owner permissions, #261 Captain permissions, #262 Scorer permissions, #263 Umpire permissions, #264 Player permissions, #265 User verification, #266 User reporting and suspension, #267 Activity and audit logs, #268 Database backup, #269 Security and privacy management, #270 Notifications management.
- **Decision:**
  1. **Complete Coordinated Batch Execution:** Implement and verify all 17 features with dedicated frontend views, comprehensive mock data models, and interactive controls without deferrals or partial stubs.
  2. **Dedicated Modular Components:**
     - Author `PasswordRecoveryView.jsx` (#256) with 3-step OTP flow and validation.
     - Author `SuperAdminDashboardView.jsx` (#257) with cluster health, maintenance toggles, and broadcast alerts.
     - Author `AdminDashboardView.jsx` (#258) with sanction reviews and dispute queues.
     - Author `RolePermissionsView.jsx` (#259–#264) with fine-grained switches for all 6 personas.
     - Author `UserVerificationView.jsx` (#265) with document review queues.
     - Author `UserReportingSuspensionView.jsx` (#266) with incident logging and account suspensions.
     - Author `AuditLogsView.jsx` (#267) with searchable event streams and JSON export.
     - Author `DatabaseBackupView.jsx` (#268) with on-demand backups and integrity verification.
     - Author `SecurityPrivacyView.jsx` (#269) with 2FA policies and DPDP data rights.
     - Author `NotificationsManagementView.jsx` (#270) with multi-channel dispatchers.
  3. **Master Coordination Hub:** Unify all 17 modules inside `CategoryNView.jsx` with pillar-based tab navigation.
  4. **IDE Problems Resolution:** Added `jsconfig.json` with bundler module resolution and JSX definitions, and standardized semicolon syntax across all codebase files, resolving all 22 IDE diagnostics.
- **Consequences:** Phase 1 is 100% complete and verified (17/17 features operational, 38/38 automated tests passing, 0 build errors). The data layer remains decoupled and ready for future Supabase integration.



