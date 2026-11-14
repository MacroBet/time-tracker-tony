# Indice della conoscenza FieldTrack / Tony

**Modifiche UI 14nov implementate:** [report prima/dopo e prove](intake-20261114-ui-feedback.md).
Mandato diretto sui cinque screenshot; Overview, Schedule/Overdue, assistente e registro asset.

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

Nuovo lotto17ott12:07–12:15: [tag e colori per azienda, intake parziale](intake-20261017-tags-partial.md).
Cinque PNG individuati, nessun originale acquisito; scroll fallito, copertura incompleta.

**Riconciliazione serale17ott:** [mandato, copertura e richieste→lavoro](intake-20261017-evening.md).
ATT-018 L1 acquisito/letto,18 originali; testi osservati fino21:06 ma copertura
continua non attestata. Export senza media in Download non ancora leggibile.
Home per ruolo e colori tag verificati localmente; checklist/template/issue QA da
riconciliare con i materiali mancanti. Il report condiviso distingue prove e limiti.

**Verifica18ott:** [fonte nativa, copertura e confronto con lo sviluppo](intake-20261018-status.md).
Correzione diretta Marco: app nativa già autenticata, Web superato. QA13:34 letto
interamente; ATT-019–029 acquisiti, totale29. Dieci PNG e PDF18pagine letti;
XLS ora letto anche nel layout con rendering locale headless. Catalogo documenti
progetto/Phase asset/livello completato e verificato solo localmente, **5cd5ca9**,
dopo nuovo consenso umano specifico18ott. Mapping colori divergenti e cronologia
ancora parziale; nessuna equivalenza automatica fra codici documentali e review tag.
Fetch SSH precedente fallito; nessun nuovo SSH/push/deploy. Catalogo:103unitari,10API,
statici/build e browser desktop/mobile locali passati.

**Batch mail20ott concluso7/7:** [analisi integrata, matrice e prossimo passo](intake-20261020-mail-analysis.md).
Programmi MPX/XER/Excel, signoff PDF e8slide reali riconciliati con il codice;
fonti e lettore privati fuoriGit. Nessun import/sviluppo/invio/deploy.

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

**Ripresa manuale5nov:** [nuovi testi, confronto e lotto locale](intake-20261105-resume.md).
Copertura fino5nov08:11; editor rapido Gantt e template CSV vuoto verificati solo localmente.
Nessun invio o pubblicazione; import XLSX, sequenze comuni, approvatori e video restano distinti.
Prosecuzione manuale: matrice residui per parti indipendenti e fix5f4cd7c contro
perdita di metadati nei JSON parziali;29 test mirati, nessuna nuova lettura o pubblicazione.

**Ultima consegna5nov:** [XLSX asset e dashboard, prove e limiti](intake-20261105-xlsx-dashboard.md),
applicazione locale14692f6. [Contratto XLSX](../asset-xlsx-import.md),56 test mirati e
build passati. I due rami tecnici sono conclusi; resta distinto il rilievo audit
sulle dipendenze preesistenti e le decisioni di dominio ancora mancanti.

**Rilascio5nov pubblicato:** [patch sicurezza, push e prove produzione](intake-20261105-secure-release.md).
Main90dd199, Vercel Production success7573042780; XLSX/Overview, Gantt e catalogo
completati inclusi.132unitari+10API e build locali verdi, smoke pubblico sola lettura.
Audit produzione0;8moderate residue soltanto lint. Invio5nov12:40 consegnato, nessun reinvio.

**Anteprima reale5nov:** [originali analizzati,1354asset proposti, prove e piano](intake-20261105-workbooks-preview.md).
Due file acquisiti, un nuovo binarioATT-030; quattro account/ruoli verificati da Team
admin. Unico payload inventario selezionato, schema/readerJSON/CSV e idempotenza
offline passati.305task/18assegnazioni preservati; nessun import remoto. Piano
tramite normale app, consenso preciso e preview/versione prima di salvare; rollback
di rimozione oggi assente. Il worker non riceve lavoro/asset senza assegnazione.
P6 e52requisiti fuori da questa tranche; copertura delegata14:19, gap storici conservati.
[Diagnosi iniziale](intake-20261105-production-data.md) conservata come storico.

**Nuova consegna test-ready5nov:** [implementazione, prove, rilascio e percorso Tony](intake-20261105-test-ready.md).
Mandato umano successivo autorizza normali scritture app scoped nell’ambiente test;
P6/LHR11 distinto, inventario/restore, schede/firmatari/Works to go e MP4 breve.
Preview precedente storica, nessuna fonte privata in Git.

**P6/Gantt6nov:** [vista giornaliera, programma già importato e lettura indicizzata](intake-20261106-p6-gantt.md). Fonte fedele e dati cliente conservati, nessun reimport; prove desktop/mobile e misure locali distinte dalla latenza produzione.

**Parità visiva P6/Gantt6nov:** [confronto con Gantt normale, righello e scroll](intake-20261106-p6-gantt-parity.md). Il precedente PASS tecnico non equivaleva ad accettazione visiva; nuova conferma desktop/mobile con screenshot privati.
