# Indice della conoscenza FieldTrack / Tony

Leggere questo indice, [stato essenziale e backlog](register.md#stato-corrente-per-ripresa)
e [PRODUCT.md](../../PRODUCT.md) prima di rispondere sul progetto. Poi aprire solo
le fonti necessarie. Il registro è la fonte unica dello stato operativo; i recap
spiegano il percorso, non sostituiscono lo stato. Nessuna dipendenza da una chat.

| Serve capire                                                         | Fonte da aprire                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Come Marco avvia una nuova chat e come chiuderla                     | [README manuale](README.md), [istruzioni root](../../AGENTS.md)                                                                                                                                                                                            |
| Consegnato, prossimi passi, gate, copertura WhatsApp, prove e commit | [Stato corrente](register.md#stato-corrente-per-ripresa), [popup UX-004](register.md#popup-asset-e-tag-ux-004--16-ottobre-2026), [dashboard UX-003](register.md#dashboard-ux-003--16-ottobre-2026), [CX-010](register.md#consegna-cx-010--16-ottobre-2026) |
| Perché è stato scelto questo modo di lavorare                        | [Recap della collaborazione](collaboration-recap.md)                                                                                                                                                                                                       |
| Correzioni e preferenze da applicare, con ambito e prove             | [Registro degli insegnamenti](working-lessons.md)                                                                                                                                                                                                          |
| Obiettivo prodotto, utenti, invarianti                               | [PRODUCT](../../PRODUCT.md)                                                                                                                                                                                                                                |
| Uso dell'app, quattro percorsi e setup tecnico                       | [README principale](../../README.md), [casi d'uso](../use-cases.md), [architettura](../architecture.md)                                                                                                                                                    |
| Requisiti Tony e cosa mostrano davvero ZIP/Excel                     | [Prima analisi e delta](analysis.md), [intake 19:12](intake-1912.md), [intake Excel e ID 16 ottobre](intake-20261016.md), [popup asset 12:41–13:04](intake-20261016-asset-popup.md), [riconciliazione fino14:14](intake-20261016-1414.md)                  |
| Allegati: nomi, provenienza, dimensioni, hash, limiti                | [Manifest degli originali privati](attachments/manifest.md)                                                                                                                                                                                                |
| Programme ID / Activity ID / Client asset ID, CSV/JSON               | [Contratto identificativi](../programme-identifiers.md)                                                                                                                                                                                                    |
| Preflight Excel locale, anomalie e dati non importabili              | [DATA-002](asset-preflight.md)                                                                                                                                                                                                                             |
| Demo locale ricca/vuota e piano DB remoto ancora bloccato            | [Piano isolamento](local-demo-and-remote-plan.md), [manifest di revisione](demo-payload-manifest.json)                                                                                                                                                     |
| Testo storico di messaggi e stato delle bozze                        | [Bozze archiviate](drafts.md), [copertura corrente](register.md#stato-corrente-per-ripresa)                                                                                                                                                                |
| Piano iniziale di settembre                                          | [Piano storico](../tony-development-plan.md), non stato corrente                                                                                                                                                                                           |
| Metodo riutilizzabile fuori da FieldTrack                            | [Skill portabile](../../tools/skills/capture-working-lessons/SKILL.md); dettagli Tony restano qui                                                                                                                                                          |

Fonti dashboard del 16 ottobre: [intake 12:24–12:31](intake-20261016-dashboard.md),
con tre PNG salvati e due soltanto visualizzati da Show Chrome.

**Monitor esistente ACTIVE10min per nuovo mandato diretto17ott; filtri consegnati.**
[Nuovo intake](intake-20261017.md):7testi diretti10:56–11:04, richieste asset/AI
separate dalle interpretazioni. Audio esclusi da Marco, fallback ritirato;
nessun blocco audio residuo. Filtri Area/Phase d7dcb8f verificati localmente e su main; provider live spento.
[Report esecutore](regia-status.json), ponte alla regia, nessun nuovo job o scheduler.
[Invio approvato11:34 e monitor ristretto](intake-20261017-send-monitor.md): una spunta,
nuovi4testi fino11:09, produzione verificata nei metadati; nessuna nuova feature avviata.

## Orientamento al codice, solo quando serve

- Dati e permessi: `src/lib/domain.ts`, `src/lib/commissioning.ts`,
  `src/lib/permissions.ts`; import/merge in `src/lib/commissioning-import.ts` e `asset-transfer.ts`.
- Persistenza/demo: `src/server/repository.ts`, `src/server/config.ts`,
  `src/server/db/schema.ts`; fixture in `src/lib/demo-showcase.ts`.
- Programme/Assets/task/report: `src/app/components/ScheduleWorkspace.tsx`,
  `ProgrammeReference.tsx`, `CommissioningWorkspace.tsx`, `TaskDetail.tsx`, `CommissioningReport.tsx`.
- Copilot: `src/lib/copilot.ts`, `src/server/copilot.ts`, `src/server/copilot-config.ts`;
  setup nel [README](../../README.md#copilot-di-progetto). Provider live disattivato per decisione.
- Test: `tests/`; utility Excel locali: `scripts/preflight-assets-xlsx.py` e `scripts/extract-commissioning.py`.

## Manutenzione del backup operativo

Aggiornare il registro dopo un risultato; le decisioni sono lì. Aggiungere a
recap/lezioni soltanto correzioni e risultati nuovi con fonte e ambito, poi
aggiornare questo indice solo se cambiano i documenti. Non mantenere un secondo
backlog. La cronologia Git conserva le versioni precedenti; allegati privati e
`output/` restano locali e non vanno descritti come salvati nel backup Git.
La skill portabile è mantenuta in `tools/skills/`; se aggiornata, sincronizzare
la copia personale installata e confrontare i contenuti, senza editarle separatamente.

## Skill personale riutilizzabile

`capture-working-lessons` installata in `~/.codex/skills/capture-working-lessons/SKILL.md`,
con selezione automatica normale e trigger mirati. Nessuna skill personale esistente
copriva questo preciso metodo; nessuna istruzione globale è stata modificata.
La copia personale non è in Git: il [sorgente portabile](../../tools/skills/capture-working-lessons/SKILL.md)
qui versionato è il riferimento da sincronizzare, attualmente byte-identico.
`quick_validate` superato; la nuova skill sarà disponibile al caricamento del catalogo
di una nuova chat/sessione. Non serve per avviare Tony: quello dipende solo da AGENTS
e dai documenti di questa cartella.
