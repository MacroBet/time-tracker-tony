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

Thirteen supplied files in docs/tony-feedback/attachments, with a manifest; existing
application and commissioning tests. UI must use real authorized project records;
synthetic demo mode stays visibly labelled and isolated from remote data. Local
showcase fixtures are opt-in and must never seed a remote environment implicitly.

## Product Principles

- Changes must persist and have traceable authors/reasons.
- Summaries must lead to the records behind their counts.
- Missing information remains distinguishable from zero and not applicable.
- Project membership and role are enforced server-side.
