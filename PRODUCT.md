# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Construction and commissioning managers/supervisors plan and review project work;
workers execute assigned activities and submit evidence. Tony evaluates the product
with Marco using WhatsApp feedback, Excel schedules and annotated screenshots.

## Product Purpose

FieldTrack joins project schedules, assets, commissioning tags, issues and evidence.
Marco confirmed on 15 October 2026 that the authoritative programme must live in
the app. The working Gantt persists dates and dependencies. The next priority is a clear
first-use path through Assets (equipment and required tags), Programme (dates and
dependencies) and Tasks (assigned work and test sheets). Tony also needs task/check-sheet links
for individual asset tags and asset groups. The project copilot scaffold is delivered:
saved-data checks, example questions, scoped tools and task proposals with separate
preview and human confirmation. Chat requires an explicitly configured and enabled
server provider; Marco will supply the API key later. No live provider calls or
autonomous operations have been enabled. Recorded parent/child asset groups can be
consulted; a shared task/check sheet for a group still requires its rules to be defined.

## Operating Context

Responsive browser UI for desktop planning and mobile field work. Existing Next.js,
React and Neon/Drizzle backend, role and project membership boundaries. Source
feedback and acceptance backlog: docs/tony-feedback/register.md.

## Capabilities and Constraints

Preserve current authentication, stored project data and baseline history. Never
infer tag approval from test outcome or fill missing asset links with guesses.
P6 is a functional reference, not an integration to activate. Prototype ZIP files
are reference material, not a replacement app. Raw attachments remain private.

## Evidence on Hand

Eighteen verified private originals, indexed in docs/tony-feedback/attachments/manifest.md; existing
application and commissioning tests. UI must use real authorized project records;
synthetic demo mode stays visibly labelled and isolated from remote data. Local
showcase fixtures are opt-in and must never seed a remote environment implicitly.
The latest asset example has 1,354 candidate rows and repeated names. Tony requests
separate internal/client/programme references and named groups for IST, phase, area
and floor. Marco relayed Tony's verified answer “Both required” on 16 October:
programme ID and individual activity ID must both be recorded separately and linked.
The app currently holds one programme per project; existing task/asset/activity IDs
must remain stable. Group workflow rules remain unresolved. Source context:
docs/tony-feedback/intake-20261016.md.

Tony's 16 October dashboard feedback asks for status at the top, completion/late
counters with task drilldowns by recorded stage and issue priority, and a separate
overdue list. Project Health scope and On/At/Off Track rules remain undefined.
Screenshot figures are examples only; no production data is inferred.

Tony’s later feedback through 13:04 on 16 October requests tag configuration in
a popup when adding an asset. The delivered UI uses the current project ID as
read-only context and the existing Phase field, with preview and confirmation.
GROUP and ADD DATA semantics remain undefined. The new ADD PROJECT.xlsx was not
acquired; the old ATT-007 is not a substitute. The Microsoft Project playlist
URL/content remains unverified. Source: docs/tony-feedback/intake-20261016-asset-popup.md.

Evidence reconciliation through 14:14 on 16 October confirms the existing requests
and recovers the exact Microsoft Project playlist URL; lesson contents remain
unverified. Marco-approved outgoing V3 was reported delivered, with no read receipt
attested. Project Health calculation now awaits Tony’s reply. The new Excel and
GROUP/ADD DATA remain unresolved; acquisition after 14:14 is not verified.
Source: docs/tony-feedback/intake-20261016-1414.md.

Tony’s 17 October feedback requests manager/admin Overview on entry and worker
Tasks first, plus configurable tag colours. Role-based entry and display of existing
per-project tag labels/colours are delivered in c12deea, with local verification
and GitHub/Vercel deployment success. This does not add company-wide
settings. Later feedback requests reusable project templates, configurable document
requirements and check sheets with multiple steps and QA issues linked to equipment
or area. Source coverage remains partial: only the L1 diagram is newly acquired;
the checklist PDF, roadmap XLS and remaining diagrams have not been read. Step fields,
external IDs, issue rules and template versioning require reconciliation with those
sources. No live AI, automatic issue generation or imported real data is implied.
Source: docs/tony-feedback/intake-20261017-evening.md.

## Product Principles

- Changes must persist and have traceable authors/reasons.
- Summaries must lead to the records behind their counts.
- Missing information remains distinguishable from zero and not applicable.
- Project membership and role are enforced server-side.
