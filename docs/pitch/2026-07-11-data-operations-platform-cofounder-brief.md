# Cofounder Brief: Configurable Data Operations Platform

**Date:** 11 July 2026

**Working name:** ADL Data Operations Platform

**Decision status:** Product direction agreed; customer validation required before implementation

## Executive summary

African Data Layer has already built much of the infrastructure required to run trustworthy field-data operations: offline mobile collection, GPS and photo evidence, assignments, fraud and quality controls, human review, maps, dashboards, and exports.

We can capitalize on this foundation through a second commercial offer: a configurable data-operations platform that organizations use to collect and own their own field data. A client chooses what must be observed, where it must be collected, what evidence is required, and who performs the collection. The client can use its own field team, ADL's field team, or a combination of both.

This does not replace African Data Layer's original strategy. ADL continues building and selling trusted African datasets. The new platform productizes the infrastructure behind that work for organizations with their own collection needs.

The recommended model is a hybrid platform plus service:

- Software for configuration, collection, verification, review, mapping, and export.
- Optional setup, training, quality review, and managed field collection.
- Reusable industry solution packs created only after real customer validation.

The immediate priority is not building new software. The priority is validating demand with prospects, securing design partners, and obtaining a paid pilot or written commercial commitment.

## The opportunity

Many African organizations make operational decisions without a current, complete, or trustworthy view of what exists on the ground. Information is often spread across spreadsheets, WhatsApp messages, paper reports, one-time surveys, disconnected contractor systems, and staff knowledge.

Common questions include:

- Where are our physical assets, outlets, facilities, service points, or project sites?
- Which locations are active, damaged, missing, duplicated, informal, or underserved?
- Can submitted field evidence be trusted?
- What changed since the previous visit?
- Which zones have not been covered?
- Can managers receive a clean map, dataset, and evidence report without managing the collection technology themselves?

Existing form tools can capture answers. Our stronger position is operating trusted evidence workflows: geography, assignments, offline capture, photos, GPS, quality controls, review, approved records, and decision-ready outputs.

## Two products, one foundation

### African Data Layer

ADL defines collection programs, operates its contributor network, owns the resulting datasets, and sells trusted data and insights about African markets and infrastructure.

### Configurable Data Operations Platform

A client defines its own collection project and owns the resulting project data. ADL supplies the platform and any contracted operational services.

The two products share technical infrastructure but maintain a strict data boundary. Client data does not automatically become ADL data. Any reuse requires explicit contractual permission.

The platform may receive a separate commercial name later. A different name should not require a second codebase.

## Product positioning

Proposed promise:

> Tell us what you need to know on the ground. Configure the evidence required. Collect it with your team, ours, or both.

Alternative short formulation:

> Trusted field data operations, configured for your organization.

This is not positioned as another survey builder. It is a real-world data operations system designed for African field conditions.

## How the service works

Each client receives an isolated organization workspace containing:

- Team members and permissions.
- Collection projects.
- Configurable record types and fields.
- Evidence rules such as GPS, photos, timestamps, and notes.
- Geographic zones and assignments.
- Offline mobile collection.
- Automated quality and integrity checks.
- Human review.
- An approved client dataset.
- Maps, dashboards, exports, and later API access.

Three delivery modes use the same platform:

1. **Self-operated:** the client supplies and manages collectors.
2. **Assisted:** the client supplies collectors while ADL configures the project, trains the team, or reviews quality.
3. **Managed:** ADL supplies the software, collectors, and quality operation.

The hybrid model is easier to sell than pure self-service software because clients can buy an outcome before developing internal expertise. It also creates a path from service revenue toward recurring software revenue.

## Target customers

The best prospects are organizations that manage distributed physical assets, locations, networks, programs, or field teams.

Likely segments include:

- Waste and environmental operators.
- FMCG and beverage distributors.
- Telecom and mobile-money networks.
- NGOs and development programs.
- Agricultural and supply-chain organizations.
- Municipalities and infrastructure operators.
- Market-research and consulting firms.
- Health, water, sanitation, and public-service programs.

Initial sales should begin in Cameroon through warm relationships. The commercial message should focus on one operational problem for each prospect rather than presenting a broad platform.

## HYSACAM as an example, not the MVP

The HYSACAM idea illustrates the platform's value:

- Map official waste bins.
- Identify informal collection points.
- Identify illegal dumping hotspots.
- Record location, photos, condition, accessibility, overflow, usage context, and verification status.
- Show coverage gaps and possible placement improvements.
- Repeat collection to measure changes.

This could later support bin-placement decisions and, after integration with fleet, capacity, schedule, depot, road, and traffic data, collection-route analysis.

However, HYSACAM is not the MVP because no contract or validated design partnership exists. We should not build HYSACAM-specific functionality, use its brand in a public demo, or imply a partnership.

A neutral demonstration can show an **Urban Waste Mapping** scenario using synthetic data. HYSACAM can then help validate the actual workflow, requirements, buying process, and pilot scope.

The same platform could later support:

- Retail outlet and product-availability audits.
- Mobile-money agent verification.
- Agricultural site and intervention monitoring.
- Road, drainage, water, sanitation, or public-facility inventories.
- Health-facility verification.
- Development-project monitoring and evaluation.

## Sustainable Development Goal relevance

The first market narrative can align with SDG 11, Sustainable Cities and Communities, particularly urban environmental impact and municipal waste management. Water and sanitation projects can align with SDG 6; climate and environmental monitoring with SDG 13; agricultural monitoring with SDG 2.

SDG alignment strengthens donor and public-sector relevance, but the commercial pitch should still lead with a concrete operational outcome: better asset visibility, verified project evidence, improved coverage, lower data-cleaning cost, or faster decisions.

## Validation before implementation

The team should not begin building a horizontal SaaS platform based only on internal enthusiasm. Phase 0 uses the current ADL product, synthetic data, diagrams, and targeted demonstrations to validate customer demand.

Each customer conversation should establish:

- The operational decision the customer is trying to improve.
- The current data gap and cost of that gap.
- Existing tools, databases, spreadsheets, and field processes.
- Required record types, fields, evidence, and update frequency.
- Who collects, supervises, reviews, and consumes the data.
- Required maps, dashboards, reports, exports, and integrations.
- Security, retention, ownership, and data-residency requirements.
- The decision-maker, budget owner, procurement process, and timeline.
- A credible paid-pilot scope and acceptance criteria.

The proposed validation gate is:

- 10 relevant customer conversations.
- 3 qualified organizations willing to act as design partners.
- At least 1 paid pilot, signed letter of intent, or equivalent written commitment.
- Repeated core requirements across at least 2 organizations.

If prospects share a common need, we proceed with the configurable platform. If demand is concentrated in one narrow vertical, we build a bounded vertical product instead of forcing a horizontal SaaS strategy.

## What the post-validation MVP would be

The MVP should be an empty configurable workspace, not a waste-specific or HYSACAM-specific application.

The client should be able to:

- Create an organization and project.
- Define record types and fields.
- Select required evidence.
- Define geography and assignments.
- Invite collectors and reviewers.
- Collect offline through dynamic mobile forms.
- Review submitted evidence.
- Build an approved client dataset.
- View records on a map.
- Export CSV and GeoJSON.

The first contracted customer may create the first reusable solution pack. A solution pack is standard configuration, guidance, review rules, and outputs for a repeated use case. It is not a separate app.

The MVP explicitly excludes route optimization, live truck tracking, client-specific branded apps, complex workflow automation, automated billing, a template marketplace, and a separate database deployment for every customer.

## Technical leverage

Most field-operation capabilities already exist in ADL:

- Mobile web, Android, and iOS delivery.
- Offline queue and reconnection.
- Camera, GPS, and device context.
- Geographic assignments.
- Idempotent submissions.
- Evidence, fraud, and risk checks.
- Admin review.
- Maps, dashboards, and exports.
- English and French support.

The genuinely new platform work is narrower:

- Organization workspaces.
- Tenant isolation.
- Project roles.
- Configurable schemas and evidence rules.
- Dynamic field forms.
- Client-scoped dashboards, records, exports, and API access.
- Versioned project configuration.

This reuse is the strategic advantage. We should extend one shared engine rather than maintain separate client applications.

## Data ownership and trust

Every client organization must remain isolated. One client must never access another client's configuration, records, photos, analytics, or exports.

Required principles:

- Every record belongs to an organization and project.
- Every operation checks membership and role.
- Photos and evidence require authorized access.
- Configuration changes, exports, and review decisions are audited.
- Offline drafts remain safe until acknowledged by the server.
- Retries do not create duplicate records.
- Historical evidence is preserved rather than silently overwritten.
- Client data is not used for ADL products, AI training, benchmarking, or cross-client analytics without explicit permission.

The first version can use shared PostgreSQL infrastructure with strict logical isolation. Dedicated database and storage can become an enterprise option later.

## Go-to-market motion

The fastest sales path is outcome-led:

1. Obtain a warm introduction.
2. Diagnose the customer's field-data problem.
3. Demonstrate the relevant workflow with synthetic data.
4. Propose a small paid pilot with fixed geography, record target, outputs, and completion date.
5. Deliver a verified dataset, map, evidence package, and management presentation.
6. Convert the pilot into a recurring self-operated, assisted, or managed agreement.

The first contract should be a fixed-price pilot rather than a complex SaaS subscription. After proof, recurring revenue can combine:

- Platform subscription.
- Setup and training.
- Usage based on projects, collectors, or records.
- Quality-review service.
- Managed field operations.
- Enterprise API, infrastructure, and support.

Discovery may be free. Client-specific configuration, fieldwork, integration, and software development must be paid.

## Main risks and responses

### Building before demand

**Risk:** months of platform work without a buyer.

**Response:** enforce customer-validation gate before implementation.

### Becoming a consulting company

**Risk:** every customer requests a different application.

**Response:** standardize configuration, price exceptions separately, and create solution packs only for repeated requirements.

### Weak differentiation from form tools

**Risk:** prospects compare only form features and price.

**Response:** sell trusted evidence operations: assignments, offline capture, provenance, quality, review, maps, and decision-ready outputs.

### Cross-client data exposure

**Risk:** multi-tenancy creates severe trust and legal exposure.

**Response:** central tenant authorization, database isolation, protected media, audit logs, and mandatory cross-tenant security tests.

### Service margins overwhelming SaaS margins

**Risk:** managed collection grows revenue but remains labor-intensive.

**Response:** measure margins by delivery mode and create an explicit path from managed to assisted or self-operated usage.

### Distracting from core ADL

**Risk:** platform work slows the original data-product roadmap.

**Response:** preserve the two-product boundary, share infrastructure, require commercial validation, and allocate work only after a signed opportunity justifies it.

## Decisions reached

- Hybrid platform plus service is the preferred model.
- The product is a configurable data-operations platform, not a generic survey builder.
- ADL's original dataset business continues.
- Client data remains separate from ADL-owned data.
- HYSACAM is a valuable prospect and example, not the MVP.
- Customer validation comes before new platform implementation.
- The post-validation MVP is an empty configurable workspace.
- One shared engine should support multiple industries through configuration.
- Solution packs emerge from signed or repeated customer demand.
- Initial market entry starts in Cameroon through warm contacts and paid pilots.

## Recommended immediate sequence

First, prepare a concise discovery deck and neutral synthetic-data demonstration using capabilities already present in ADL. Second, conduct structured conversations with the HYSACAM CEO contact and prospects in other sectors. Third, record repeated requirements, buying signals, objections, and pilot conditions. Fourth, secure a paid pilot or written commitment. Only then should the team authorize the platform MVP implementation plan.

The core strategic test is simple:

> Will organizations pay ADL to configure and operate trusted field-data workflows using infrastructure we have already built?

If the answer is demonstrated through commitments rather than compliments, the platform becomes a credible second growth engine for African Data Layer.
