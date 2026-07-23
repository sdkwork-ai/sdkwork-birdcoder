# SDKWork BirdCoder PRD

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder
Updated: 2026-07-23
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, SECURITY_SPEC.md

## 1. Background And Problem

BirdCoder provides an AI-assisted coding workbench without becoming another
system of record for every capability visible in its UI. Earlier design work
created overlapping Workspace, Project, AI-session, messaging, Skill, and
runtime-location concepts. Because the application has not launched, keeping
those overlaps would add permanent coupling without a compatibility benefit.

The product now composes independent SDKWork capabilities through their public
SDKs. The Rust gateway owns only application System metadata. PC owns
presentation and local host capabilities, not remote business aggregates.

## 2. Target Users

| User | Outcome |
| --- | --- |
| PC developer | Organize canonical Agents Projects, use AI Sessions, edit files, run local terminals, and operate Git from one workbench. |
| Team developer | Use IAM organization scope and owner-module authorization without a second workbench Workspace identity. |
| Operator | Deploy and observe a stateless BirdCoder gateway without a BirdCoder database lifecycle. |
| Security reviewer | Trace every fact to one owner and verify that local paths, credentials, and human messages do not cross incorrect boundaries. |

## 3. Goals And Non-Goals

Goals:

- Use one canonical Agents Project and one `projectId` across PC workflows.
- Use the Agents Session, Turn, Session Item, Interaction, and Runtime Binding
  lifecycle for every AI assistant workflow.
- Keep human IM communication semantically and operationally distinct.
- Keep Skill lifecycle in Skills and consume it through its generated SDK.
- Keep directory mounts, filesystem access, Git, worktrees, and terminals
  local to PC host adapters.
- Keep the Rust gateway stateless and its BirdCoder-owned API minimal.
- Fail closed when an owner capability or required composition contract is
  unavailable.

Non-goals:

- Maintaining a BirdCoder Workspace, Project, Session, message, Skill, or
  runtime-location system of record.
- Retaining pre-launch compatibility data, route aliases, dual identifiers, or
  synchronized copies.
- Treating a local directory path or opaque runtime id as authorization for
  remote code execution.
- Emulating a missing document composition type with a different composition
  slot.
- Modifying or claiming completion for H5 or Flutter in this Rust-and-PC
  cutover.

## 4. User Scenarios

1. A signed-in user works within IAM organization scope and lists or creates
   canonical Agents Projects.
2. The PC client selects an Agents Project, creates an Agents Session with the
   same `projectId`, and writes the opaque local runtime reference through
   Agents `sessionRuntimeBindings`.
3. The assistant transcript renders Agents Session Items. A human conversation
   uses IM Conversation and Message APIs and is not used as transcript storage.
4. A Tauri user selects a local directory. PC records a subject-scoped device
   mount keyed by the canonical `projectId`; native paths remain inside the
   host boundary.
5. Terminal, filesystem, Git, and worktree actions resolve the authorized local
   mount and fail closed when it is missing or stale.
6. A project uses an Agents `drive/drive` composition slot for sandbox
   storage and `document/documents` slots for project documents. PC resolves
   document references through the injected Documents App SDK and owns no
   document binding, content, version, or projection authority.
7. An operator deploys the Rust gateway without a BirdCoder database,
   migration, backup volume, or server-side project directory.

## 5. Functional Requirements

1. BirdCoder owns only System descriptor, health, route, and runtime metadata.
2. The server owns no business table or database lifecycle.
3. PC Project operations use the generated Agents App SDK and one canonical
   `projectId`.
4. PC AI workflows use canonical Agents Sessions and Session Items without a
   local Session or transcript authority.
5. Session creation records runtime association through the Agents runtime
   binding resource when local execution context is required.
6. Skill workflows use the Skills SDK. Human messaging belongs to IM and uses
   the IM SDK when that separate product capability is enabled.
7. Tauri device state accepts only the explicit settings, project-mount, and
   installation-identity namespaces.
8. Sandbox composition uses `drive/drive`; document composition accepts only
   canonical `document/documents` slots and fails closed before a Documents
   SDK call when the slot pairing or reference is invalid.
9. Frontend features consume injected owner clients or ports and do not
   implement raw transport or local SDK forks.
10. Rust and PC documentation, contracts, generated SDKs, and runtime behavior
    remain mutually consistent.

## 6. Quality, Security, And Commercial Gates

| Gate | Required outcome |
| --- | --- |
| Cohesion | Every business fact has one owner with its own API, SDK, persistence, and lifecycle. |
| Coupling | Integration uses generated owner SDKs, stable identifiers, and explicit ports. |
| Security | Authorization fails closed; local paths, tokens, and device-state payloads do not enter server APIs or logs. |
| Performance | Owner-side pagination is preserved and PC view adaptation stays in memory. |
| Reliability | Missing mounts, runtime bindings, topology, or unsupported composition types return explicit failures. |
| Reproducibility | API assembly and SDK generation are repeatable and generated files are not hand-edited. |
| Operations | The gateway deploys statelessly with health, readiness, metrics, rollback, and dependency diagnostics. |
| Release | Rust, PC, API, SDK, IAM, architecture, documentation, and security gates pass with no accepted debt list. |

## 7. Delivery Scope

The current delivery scope is:

- Rust assembly, gateway, System routes, and Tauri host;
- PC browser and desktop packages;
- BirdCoder System-only App SDK;
- owner SDK integration for Agents, Skills, IAM, Drive, and Documents, plus
  the explicit IM ownership boundary for any future human messaging feature;
- architecture, operations, and release documentation for those surfaces.

H5 and Flutter remain outside this cutover and cannot be used as evidence that
the current migration is complete.

## 8. Linked Requirements

- [REQ-2026-0002 Domain ownership convergence](../requirements/REQ-2026-0002-domain-ownership-convergence.md)
- [ADR-20260722 Owner-composed stateless workbench](../../architecture/decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
- [Direct cutover record](../../migrations/MIG-2026-0002-domain-ownership-cutover.md)
- [Technical architecture](../../architecture/tech/TECH_ARCHITECTURE.md)

## 9. Open Questions

No product-boundary question is open for the current Rust-and-PC cutover.
Additional composition kinds must be added by their owning modules before PC
can consume them; BirdCoder does not invent aliases or compatibility slots.
