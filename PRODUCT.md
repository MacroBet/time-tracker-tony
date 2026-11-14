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
server provider; Marco authorized reuse of the existing repository key on 10 November. A bounded
synthetic API test passed; cloud activation and durable metering remain separate
verification gates. Autonomous operations have not been enabled. Recorded parent/child asset groups can be
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

Twenty-nine verified private originals, indexed in docs/tony-feedback/attachments/manifest.md; existing
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
or area. On18October, all ten17October PNGs and the18-page checklist PDF were
acquired and read. The acquired roadmap XLS was subsequently rendered with the bundled headless
reader: its layout and connections are now readable. Historical chat coverage remains partial.
The references use different level/colour mappings, so no universal mapping is
inferred. Step fields, external IDs, issue rules and template versioning remain
incomplete. The manual document catalog is implemented and validated locally for each project,
existing asset phase and tag level. Admins name required/not-required items; tag
test sheets show the current applicable list. It has no completion or approval
gates. The completed catalog was published with the verified 5 November release. No live AI, automatic issue generation
or imported real data is implied.
Source: docs/tony-feedback/intake-20261018-status.md.

The 5 November local continuation adds canonical asset XLSX import and a blank
text-formatted Excel template, using the existing preview, validation and save
pipeline. One visible worksheet is supported; formulas, external connections and
ambiguous workbook structures are rejected. The Overview now puts the existing
summary and work needing attention first, with deeper analyses behind disclosure
controls. Metrics and role/project boundaries are unchanged; both changes are
published in the verified 5 November release (90dd199). Sources: docs/asset-xlsx-import.md,
the 5 November delivery report and docs/tony-feedback/intake-20261105-secure-release.md.

The delegated 5 November replies through 14:19 confirm FR as Phase in the newest
ACC asset export, request a works-to-go field/list, configurable project signatories
managed by QA and checksheet assignment to equipment. Both supplied XLSX originals
are now analysed: the Asset List is byte-identical to ATT-014; ATT-030 contains
52 requirements, with no response/signature columns. Marco selected real Tony data.
The inventory-only proposal has 1,354 schema-valid assets, proposed internal IDs,
Product/System as equipmentType, FR as phase and empty commissioning levels.
JSON/CSV readers and offline repeat-import checks pass; no remote import occurred.
All four supplied accounts/roles are confirmed in Admin Team, without direct logins.
Observed AMS16 · Test has 305 tasks, 18 worker assignments and no assets/programme;
these remain untouched. Managers/admins/supervisors retain project-scoped register
access; inventory alone does not give a worker assigned work or visible new assets.
The subsequent human mandate authorizes delivery to the named test environment.
Scoped add-only inventory batches and controlled restore now preserve record
ownership, versions, references and audit. The normal app flow needs no new SQL
privileges or credentials. Northbank remains local synthetic data. The separate
P6 source programme preserves all 16,969 activities, 36,923 links, calendars and
source fields; its saved dates are not recalculated by the working-day engine.
Equipment checksheets, project signatories and Works to go persist independently
of task status; answers and signatures begin empty. Bounded MP4 evidence uses the
existing authorized task storage, without another provider. Local tests/build/UI
are verified; exact production deployment/import outcomes are recorded in
docs/tony-feedback/intake-20261105-test-ready.md.

The 10 November increment adds a compact voice/keyboard assistant entry. Asset
search uses the full authorized project inventory, returns exact totals and bounded
pages, and links to the same filters in Assets. Voice starts only on explicit
microphone permission and returns a transcript for review before sending. Existing
management-only Copilot access and confirmed task proposals remain unchanged.
Equipment status separates recorded tests, reviews, checksheet responses/signatures
and open issues. Tasks shows saved equipment context in admin rows/details and
worker cards. No source screenshot values or new assignments are inferred. Release,
cloud configuration and durable metering evidence: docs/tony-feedback/intake-20261110-ai-assistant.md.

The 14 November UI increment uses Schedule and Project assistant as interface labels.
Desktop headers place project selection beside the title; Overview puts reports below
the compact summary. Overdue is a Schedule view with the old URL retained. The asset
register uses readable names, column filters and inline tag applicability; copied
configuration never includes test results or signatures. Duplication creates a new
identity; referenced deletion and level removal are blocked with a reviewable preview.
Source durations can display calendar-derived days while preserving original hours.
Source: docs/tony-feedback/intake-20261114-ui-feedback.md.

## Product Principles

- Changes must persist and have traceable authors/reasons.
- Summaries must lead to the records behind their counts.
- Missing information remains distinguishable from zero and not applicable.
- Project membership and role are enforced server-side.
