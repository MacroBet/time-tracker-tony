# OpenAI passive accounting — 18 October 2026

Scope: existing FieldTrack `runCopilotTurn` Responses transport, including every
function-tool round. No other OpenAI client was found in `src`. The request uses
`stream:false`; bounded HTTP body reads can still fail, stall or be cancelled.
The existing stream cancellation from 9f24459 is preserved. No AI activation,
credential changes, provider calls, remote DB writes, timers or HTTP endpoints.

## Storage and evidence

Server configuration injects `recordOpenAIAttempt`; the authenticated route passes
its existing project ID. Each turn receives a random logical request ID and every
actual transport invocation gets its own random attempt/event ID. No automatic
retry exists; invoking again creates a distinct attempt. `jobId` remains null.

Development default: ignored `output/api-metering-private` below the working
directory. `OPENAI_METER_DIRECTORY` can select an absolute private canonical
location. Production requires this explicit directory on **durable storage**;
there is no ephemeral/serverless fallback. Missing/unwritable storage prevents
transport invocation with a generic error. A filesystem path alone does not prove
cloud durability; provisioning and deployment remain unverified.

The directory is 0700 and files 0600. Immutable `<attempt>.pending.json` records
intent before transport. `<attempt>.final.json` is fsynced and published atomically
with a hard link, followed by directory fsync. Identical final replay is idempotent;
conflicting replay fails. Pending intent without final is reported as pending,
never exported as failure/zero usage. A crash between intent and transport cannot
prove dispatch; a crash after dispatch cannot prove final consumption. Failed
final persistence surfaces a generic error and preserves pending evidence.

`src/lib/openai-metering.ts` defines metadata and maps measured usage.
`src/server/openai-meter-store.ts` exposes `readOpenAIMeterExport(directory)`:
final `events`, unresolved `pendingAttempts`, and metadata-only `observations`.
The latter preserves latency, attempt number, completion/interrupt detail, usage
completeness, and a SHA-256 provider request-ID reference. The v1 collector event
has its own logical request ID; the raw provider header is never persisted.
Closed schemas drop additional fields, including nested response content.

Model means returned model, not a configured alias; absent actual model is null.
Missing token details are null. Input/cache/cache-write and output/reasoning are
subsets: total is input+output, with no extra reasoning/cache addition. Every
request is counted once; no chunk/cumulative events. Incomplete valid responses
retain measured usage with failure status. Cost estimate/billed remain null: no
verified model tariff or billing evidence is configured. No historical/account
coverage, FX conversion, recharge accounting or Codex-plan cost is inferred.

## Collector contract and finite export

Compatible with Mea `API_METERING_V1.md`, schemaVersion 1, source
`fieldtrack-copilot-responses`. Event fields are exactly the approved contract;
sidecar observations are not silently added to that contract. No absolute Mea path
is embedded in application code and no cross-repository module is imported at runtime.

Run locally, with absolute private paths, without dotenv or provider access:

```sh
node --import tsx scripts/export-openai-metering.ts ABS_SPOOL_DIRECTORY ABS_NEW_EXPORT_FILE [OFFSET]
```

Writes a new 0600 file `{schemaVersion:1,events:[...]}` (maximum 1000 events),
prints only export/pending/remaining counts. Optional offset supports a finite
stable snapshot; stop producers while paginating or use one frozen directory copy.
Re-importing an identical batch is safe under the collector's idempotency contract.
The collector's own import CLI can validate this file before a separately explicit
apply. Export omits pending attempts and detailed observations, so the consumer
must retain the reported pending count as a coverage limitation.

**Connected:** server provider → local spool (mock integration verified).
**Prepared:** atomic `collector-v1.json` projection → collector read, and finite compatible export → collector import.
**Not verified:** running server adoption, real provider usage, live collector
publication, central UI, historical/account totals, production durable storage.
No service restart, push or deploy was performed.

After each durable pending intent (before HTTP) and each final event, the recorder updates `collector-v1.json` in the same
private spool directory with `{schemaVersion:1,events:[...],pendingAttempts:[...]}` via
fsync/atomic rename. A short exclusive projection lock prevents concurrent
writers from replacing a newer snapshot with an older one. Lock contention or
stale crash locks surface an accounting error; final event files remain durable.
An operator must resolve stale locks explicitly and replay the unchanged final
observation to refresh the projection. An empty private projection was explicitly initialized on 18 October, then updated
to include an empty pending array. No synthetic runtime event was seeded. Empty
arrays report no observed local attempts, never an account total of zero.
The central reader integration is owned by Mea and has not been verified here.

## Validation and sources

113 tests passed (`npm test`), including eight added metering tests: success,
missing usage/incomplete response, interruption/cancel/HTTP error/timeout,
idempotency/conflict/retry, pending and disabled gates, storage failure, tool rounds.
A separate process reads persisted events. Typecheck, scoped ESLint and an isolated production build passed.
One synthetic event passed the actual collector's `normalizeApiEvent` in a finite
read-only compatibility check; no collector ledger mutation occurred.

Official schema reviewed 2026-10-18:
[Responses retrieve](https://developers.openai.com/api/reference/resources/responses/methods/retrieve),
[reasoning usage](https://developers.openai.com/api/docs/guides/reasoning).
The schema search exposed input cache/cache-write and reasoning detail fields;
the full retrieve page fetch exceeded the tool limit, while the reasoning guide
was fetched successfully. No unverified model price table was introduced.


## Pending coverage correction — 18 October 2026

Job `mea-api-consumption-pending-coverage-20261018`, request
`mea-api-consumption-pending-coverage-request-20261018`, owner Mea, intake 585.
The collector projection now includes `pendingAttempts` using the backend's closed
`normalizeApiPending` contract: provider, attemptId, requestId, projectId, jobId,
startedAt, source. No model, status, usage, cost or payload is inferred for a stub.
Final events remain unchanged. A final suppresses the same attempt's pending stub;
the immutable intent file stays on disk for audit.

Intent file AND atomic projection are fsynced before transport begins. Failure to
publish the projection prevents HTTP. A process exit inside transport leaves the
pending observable centrally; dispatch, completion and cost remain uncertain.
If final projection fails after final-file persistence, the collector may temporarily
retain the pending until explicit recovery; it cannot silently infer free usage.
The finite import CLI remains finals-only; the fixed-source collector consumes the
extended projection directly.

25 focused provider/meter tests passed, including PREHTTP observation from another
process and abrupt process exit bypassing finally, then final supersession.
Typecheck and scoped lint passed. The backend's actual `normalizeApiPending` and
`buildApiSnapshot` accepted synthetic producer output: pending counted once with
unknown cost, final plus stale pending counted once as finalized. No central
ledger mutation, runtime fixture, provider request or server restart.

Code-only model audit: `getCopilotConfig()` reads `OPENAI_MODEL` without a default;
absent value is undefined. No specific model or official tariff can be selected
from this code. No environment value was inspected. Estimate and billed stay null.
