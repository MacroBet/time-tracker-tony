# FieldTrack — decisioni e responsabilità per il piano feedback Tony

Data creazione: 2026-11-13
Stato: in_review
Scope: `tony-feedback-plan-20261113`, proposta R1–R5, sola pianificazione.
Compilatore: Codex, owner Tony. Marco decide in chat; Codex sincronizza.
Sessione decision board: non fissata. Deadline: null; nessuna scadenza concordata.
Il 2026-11-17 è contesto della visita riferita, non una consegna acquisita.

Il form-first richiesto dalla regia mantiene i dettagli senza trasformarli in un
questionario per Marco. **Le sole tre decisioni business iniziali proposte sono
F04 vendor, F01 percentuale/colori, F03 approvatori.** F02/F14/F16 sono scelte
future del rispettivo rollout. Gli altri dieci item sono responsabilità tecniche
Codex, non ulteriori approvazioni umane obbligatorie.

R1 può essere scelto come lotto UI unitario senza chiudere tutti questi item:
vendor e formula condizionano i report avanzati, non padding, copy o navigazione.
Questo documento non acquisisce ora un mandato funzionale e non chiede un GO
indifferenziato a tutte le tranche.

Piano/fonti: [piano integrato](../docs/tony-feedback/intake-20261113-feedback-plan.md).
IMG/U/T… rimandano alle fonti del piano; originali e testo privato in
`output/tony/feedback-plan-20261113/`, esclusi da Git. Le opzioni precompilate non
sono risposte di Marco. `in_review` per un controllo tecnico indica lavoro di
validazione Codex, non consenso umano mancante. Confidenza non significa consenso.

## Tre decisioni business prioritarie

| ID | Question | Answer | Confidence | Owner | Deadline | Status | major_change_id | source_ref | impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F04 | Vendor indica fornitore, fabbricante o soggetto di supporto? | Decisione prioritaria per U2/3/4/6: raccomandazione U6 = soggetto che esegue/supporta l’attività, associato esplicitamente. Fornitore equipment e fabbricante distinti. Marco conferma significato e responsabilità di validazione; Codex propone fonte/campo/mapping. Owner e companyId non sono sostituti impliciti. Risposta non acquisita. | alta sul gap, semantica da decidere | Marco | null | in_review | AI-01 | U2/3/6; assetSchema; piano AI-04 | Necessario per report vendor e supporto attività; nessun backfill inventato. |
| F01 | Che cosa misura la % e quale precedenza hanno i colori? | Proposta: passi obbligatori applicabili superati / obbligatori applicabili; N/A esclusi solo esplicitamente. Firme/review separate. Rosso late prima di arancio residui, poi verde completato puntuale; neutro solo non completato/non scaduto, ignoto distinto. Alternativa: % livelli approvati/applicabili, con etichetta diversa. Risposta non acquisita. | media sulla proposta, alta sulla distinzione dei dati | Marco | null | in_review | GS-01 | T1112-1154; IMG3; piano GS-01 | Determina metrica comune, mapping, report e colonna Gantt; non blocca piccoli ritocchi R1. |
| F03 | Admin soltanto o anche manager può confermare lo schedule? | Proposta: admin/manager confermano il proprio draft esatto, supervisor solo proponente senza grant nuovo. Alternativa: admin approva anche le proposte manager, con coda durevole tra utenti. Risposta non acquisita; policy attuale più ampia non è consenso alla nuova. | alta sul gap, media sulla proposta | Marco | null | in_review | AI-05 | U-PERM; server/copilot.ts; lib/permissions.ts | Cambia permessi e workflow; policy unica su AI, edit manuali e import schedule. |

## Scelte di prodotto rinviate alla tranche pertinente

Non sono prerequisiti aggiuntivi di R1. F02 riguarda obiettivo e rollout sui record
reali LHR11; proposta architetturale, spike/prove e stima sono responsabilità Codex.

| ID | Question | Answer | Confidence | Owner | Deadline | Status | major_change_id | source_ref | impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F02 | Quale rollout di prodotto serve prima sullo Schedule reale LHR11? | Pending R4. Proposta: prima anteprime sugli ID importati esistenti, poi date/dipendenze confermabili, infine creazione attività per asset. Codex deve prima dimostrare contratto selettivo/versionato, integrità grafo/calendari/riferimenti e fornire soluzione/stima. Overlay/proiezione e limite15000 vs16969 sono responsabilità tecniche Codex, non opzioni architetturali da scegliere aMarco. | alta sull’esito atteso; stima ancora null | Marco | null | pending | AI-05 | U7–9; piano sezione R4: proposta tecnica e prova | Scelta di perimetro/rollout prima delle mutazioni; non blocca UI e non è soddisfatta da nuove attività app scollegate. |
| F14 | Chi cura e pubblica le lesson? | Pending R5. Proposta: record separato con autore/versione/fonte e visibilità esplicita; issue consultate alla fonte, note private non promosse automaticamente. | media | Marco | null | pending | KB-01 | T1111-1507; piano KB-01 | Nuovo contenuto persistente e responsabilità editoriale senza automatismi AI. |
| F16 | Serve una demo per il 2026-11-17? | Nessuna deadline acquisita. Proposta eventuale MVP condizionato al GO: R1 + un report end-to-end R2/R3; non tutte le mutazioni o biblioteca. Durate/costi null fino a scope/dati/lock. | alta sull'assenza di deadline, media sulla proposta | Marco | null | pending | N/A | T1111-1505-b; mandato 2026-11-13 | Evita promessa implicita dalla visita del capo; preserva priorità dashboard. |

## Vincoli e proposte tecniche di competenza Codex

ACL invariate, ID nuovi per le copie, nessuna copia di firme/esiti e whitelist
corrente derivano da istruzioni/contratti esistenti citati. Vanno rispettati senza
richiedere a Marco di approvarli nuovamente. Nessun nuovo lock è dichiarato.
L'introduzione di diritti più ampi o di altri comportamenti sarebbe invece una
scelta nuova da presentare specificamente; non è compresa nei default conservativi.

| ID | Question | Answer | Confidence | Owner | Deadline | Status | major_change_id | source_ref | impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F05 | Verificare la fonte della disciplina WTG e rappresentare i conflitti. | Controllo/proposta tecnica da validare nel lotto, non approvazione business richiesta: Pending R2/R3. Proposta: campo proprio oppure derivazione dichiarata da link asset/task non ambigui; conflitto e senza link separati. | media | Codex / owner Tony | null | in_review | AI-02 | U4; checksheets.ts worksToGoSchema | Evita attribuzioni e filtri falsi; non cambia stato delle task. |
| F06 | Esplicitare finestra lookahead, timezone e fonte. | Controllo/proposta tecnica da validare nel lotto, non approvazione business richiesta: Pending R3. Proposta: oggi…oggi+13 inclusivi con data/timezone/fonte visibili, ongoing sovrapposte incluse; overdue e senza data separati. Solo forecast salvato, non predizione. | media | Codex / owner Tony | null | in_review | AI-03 | U5/6; programme-source.ts | Contratto temporale ripetibile e identico fra report/AI. |
| F07 | Dimostrare la rappresentazione giorni/ore senza alterare il P6. | Controllo/proposta tecnica da validare nel lotto, non approvazione business richiesta: Pending sottolotto UI-05. Proposta: ore originali conservate; giorni solo da unità/calendario attestati, toggle visibilità durata. Nessuna divisione fissa. | alta sul vincolo, media sulla UI | Codex / owner Tony | null | in_review | UI-05 | IMG2; SourceActivityView | Preserva significato di durata e calendari; toggle non richiede nuovo motore. |
| F08 | Progettare ID leggibili e risoluzione stabile dei riferimenti vocali. | Controllo/proposta tecnica da validare nel lotto, non approvazione business richiesta: Pending R2/R4. Proposta: nome primario, riferimento progetto secondario, ID interno stabile in dettaglio; riusare campo esistente soltanto se equivalente. Le righe visive si risolvono su snapshot+ID, mai rinumerazione sorgente. | media | Codex / owner Tony | null | in_review | AS-01 | IMG6; U7; assetSchema | Evita collegamenti rotti e ambiguità dopo sort/filtro. |
| F09 | Proteggere applicabilità e copia della sola configurazione tag. | Controllo/proposta tecnica da validare nel lotto, non approvazione business richiesta: Pending R2. Proposta: sola applicabilità/configurazione, target esplicitamente selezionati e diff; mai esiti, firme, evidenze o completamenti. Drag successivo come scorciatoia accessibile. | alta | Codex / owner Tony | null | in_review | AS-03 | IMG6; AGENTS.md (non propagare risultati/approvazioni); piano AS-03 | Evita trasformare configurazione bulk in approvazione o cancellare storia. |
| F10 | Creare nuove identità nelle duplicazioni, senza attestazioni ereditate. | Controllo/proposta tecnica da validare nel lotto, non approvazione business richiesta: Pending sottolotto R2. Proposta: nuovi ID e soli campi anagrafici/configurazione scelti; niente link o attestazioni ereditati implicitamente. Preview e idempotenza; separata dalla copia tag su asset esistenti. | alta | Codex / owner Tony | null | in_review | AS-04 | IMG6; AGENTS.md (ID e dati stabili); piano AS-04 | Crea una nuova anagrafica senza duplicare identità o evidenze. |
| F11 | Proteggere riferimenti e storico nell’eliminazione. | Controllo/proposta tecnica da validare nel lotto, non approvazione business richiesta: Pending sottolotto R2. Proposta iniziale: delete solo non referenziato, preview e conferma; collegati bloccati con elenco riferimenti, nessuna cascata. Eventuale archiviazione distinta. | alta | Codex / owner Tony | null | in_review | AS-02 | IMG6; inventory restore; checksheet/WTG references | Protegge task, figli, checksheet, WTG e storia esistenti. |
| F12 | Mantenere whitelist import e validare eventuali nuovi parser da esempi. | Controllo/proposta tecnica da validare nel lotto, non approvazione business richiesta: Pending sottolotto R2. Proposta: whitelist CSV/JSON/XLSX già esistente; altri soltanto da file campione e mapping validato, nessuna promessa universale. | alta | Codex / owner Tony | null | in_review | AS-02 | IMG6; docs/asset-xlsx-import.md; piano AS-02 | Determina parser/test e rischio dati; non blocca uso formati già supportati. |
| F13 | Applicare le ACL già vigenti alla biblioteca federata. | Controllo/proposta tecnica da validare nel lotto, non approvazione business richiesta: Pending R5. Default conservativo proposto: soltanto membership/moduli consentiti attuali, ACL prima di totali/facet/snippet; nessuna condivisione globale o cross-tenant. | alta | Codex / owner Tony | null | in_review | KB-01 | AGENTS.md (membership/permessi); src/lib/permissions.ts; T1111-1507 | Preserva accessi; l'estensione oltre membership richiede una scelta diversa. |
| F15 | Applicare le annotazioni copy/IA nel lotto UI unitario. | Proposta tecnica di R1: Project assistant, Schedule nel copy conservando titolo fonte P6, preview/report sotto summary e Overdue dentro Schedule con vecchio link compatibile. Nessuna approvazione separata di ogni etichetta: viene rivisto il risultato del lotto UI. | alta | Codex / owner Tony | null | in_review | N/A | IMG1/2/4/5 | Rende concreto il lotto UI senza rebranding o affermazione legale. |

## Firma e congelamento input

- Mandato umano verificato: sola analisi e piano, fonte nel report; non viene
  ricreato un lock prodotto o un evento della regia.
- Scelte prodotto: nessuna risposta/approvazione ancora acquisita in questo form.
- Data chiusura form: null. Approvato da: null per implementazione e scelte nuove.
- Codex registra le risposte esatte con source_ref e aggiorna piano/register/stato;
  non attribuisce all'utente le raccomandazioni e non richiede lavoro editoriale.
- Nessun invio, DBwrite, provider live, deploy o codice funzionale autorizzati qui.
  Chiave/attivazione già risolte non sono oggetto di una nuova domanda.
