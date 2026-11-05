# Database Documentation: Local Cricket Management Platform

> **Document Status:** Architectural Placeholder / Deferred  
> **Current Database State:** **No database exists or has been configured**  
> **Development Directive:** Frontend development comes first; database implementation is deferred  

---

## 1. Current Status & Strategic Decision

In accordance with core architectural guidelines for the **Local Cricket Management Platform**:
- **Frontend-First Approach:** User workflows, presentation components, data visualizers, and state requirements will be established using mock schemas and static contracts before physical database infrastructure is introduced.
- **No Database Configured:** As of this milestone, no database engine (relational, document, or key-value) has been provisioned, created, or connected.
- **Zero Schema Migrations:** No migration tools, ORM libraries, table schemas, or seed files exist.

---

## 2. Infrastructure & Hosting Considerations

- **Target Hosting:** Hostinger.
- **Compatibility Inspection Pending:**  
  Hostinger deployment compatibility must be thoroughly audited before deciding on a database technology. Factors requiring inspection include:
  - MySQL / MariaDB support and connection limits on shared vs cloud hosting tiers.
  - Remote database access permissions and firewall rules.
  - Compatibility with external managed databases (e.g., Supabase, Neon, AWS RDS, MongoDB Atlas) if external DB hosting is preferred.
  - Connection pooling availability and cold-start latency.

---

## 3. Anticipated High-Level Data Domains

While no physical tables or collections are defined, the platform's 310 features across 17 categories (A–Q) will eventually interact with core cricket entities. Detailed domain modeling will follow source confirmation of feature specifications:

| Domain Entity Area | Purpose / Anticipated Role | Entity Status |
| :--- | :--- | :--- |
| **Tournament & Leagues** | Management of local tournaments, stages, rounds, points tables | *Pending source confirmation* |
| **Teams & Rosters** | Team profiles, player memberships, captaincy, team registration | *Pending source confirmation* |
| **Players & Profiles** | Player bio, career statistics, batting/bowling attributes, roles | *Pending source confirmation* |
| **Matches & Fixtures** | Scheduling, venue allocation, toss records, match conditions | *Pending source confirmation* |
| **Scoring & Ball-by-Ball** | Deliveries, runs, wickets, extras, dismissals, overs, partnership stats | *Pending source confirmation* |
| **Officials & Scorers** | Umpires, scorers, match referees, administrative permissions | *Pending source confirmation* |
| **Category N Specific Data** | Data entities associated with Phase 1 Features #254–270 | *Pending source confirmation* |
| **Other Categories (A–M, O–Q)** | Data models supporting remaining 293 features | *Pending source confirmation* |

---

## 4. Pending Architectural Decisions

| Decision Topic | Options Under Consideration | Status |
| :--- | :--- | :--- |
| **Database Paradigm** | Relational (PostgreSQL / MySQL) vs Document-based (MongoDB) | **Pending Technology Stack Finalization** |
| **ORM / Query Builder** | Prisma, Drizzle, TypeORM, Kysely, or raw SQL | **Pending Backend Stack Decision** |
| **Hostinger Integration** | Native Hostinger MySQL vs Managed External Cloud Database | **Pending Hostinger Compatibility Inspection** |
| **Offline / Local Scoring Sync**| IndexedDB / SQLite in-browser caching for offline match scoring | **Pending Scoring Engine Specification** |
| **Data Migration Strategy** | Automated migration tooling and seeding strategy | **Deferred to Backend Phase** |

---

## 5. Next Steps for Database Architecture

1. Complete frontend development and validation across the phased roadmap.
2. Formulate concrete data contracts based on finalized UI components and mock states.
3. Conduct the Hostinger database compatibility inspection.
4. Draft the physical Entity Relationship Diagram (ERD) and migration scripts during the scheduled backend phase.

