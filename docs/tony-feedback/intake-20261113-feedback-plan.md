# FieldTrack — piano di lavoro da discutere, 2026-11-13

## Proposta

Partire dalla dashboard richiesta da Tony: UI più compatta e leggibile, Schedule
più chiaro, registro asset utilizzabile. Collegare poi dashboard e assistente agli
stessi report verificabili. Introdurre le modifiche al programma soltanto dopo
aver fissato programma modificabile e approvazione; biblioteca cross-project in
una tranche separata. La colonna percentuale/semaforo sembra piccola, ma dipende
da dati e regole di completamento che non sono ancora equivalenti fra loro.

**Analisi del pacchetto ricevuto conclusa: 15 testi forniti da Marco e 6/6 PNG
letti, integrati con le letture delegate. Piano pronto per discussione, non
approvazione all'implementazione.** Non si dichiara letta tutta la cronologia
WhatsApp. Nessun codice funzionale, DBwrite, chiamata provider, deploy o invio.

## Mandato, fonti e copertura

Job manuale `tony-feedback-plan-20261113`, request
`tony-feedback-plan-request-20261113`, owner Tony
`01a1407b-ee5f-72a0-bc3e-f883cdd78130`, deadline **null**.
Mandato umano verificato nella regia `01a1493a-ee0b-7d62-a861-d8d546bf013c`,
messaggio `01a1d4af-979e-78c2-9a5e-10847a8a77a4`.
L'estrazione diretta di 15 testi è nel messaggio
`01a1d4b7-af30-7772-a35d-d6f9ae77f297`; i sei PNG nel messaggio
`01a1d4b7-bee0-7413-9ac5-72cd2477d9fe`. Marco conferma di aver estratto i materiali
nel messaggio `01a1d4b7-566a-7f50-9a25-b6be875b196d`.

Riferimenti usati nel piano:

- **U1–U9**: casi d'uso numerati nei testi forniti direttamente da Marco,
  2026-11-10 21:39–22:07; **U-PERM**: testo 2026-11-11 15:05:38.
  U6, vendor necessari nelle prossime due settimane, risolve il contenuto mancante
  delle 21:43:11 attraverso fonte umana, non una nuova lettura CUA.
- **IMG1–IMG6**: Overview, Schedule, matrice Closeout Tracker, assistente,
  Overdue, registro Assets. Letti visivamente da root 6/6; originali privati
  conservati in `output/tony/feedback-plan-20261113/originals/`, manifest privato
  `manifest.private.json` con byte/SHA256/provenienza. IMG3 è identico per hash ad
  ATT-031; gli altri abbinamenti ai nomi WhatsApp sono inferenze, non byte-match.
  Annotazioni analizzate come richieste, numeri/mock mai trattati come dataset.
- **T1110-2117**: dashboard prioritaria; **T1111-1507**: biblioteca asset,
  issue e lessons fra progetti; **T1112-1154**: percentuale/semaforo Gantt.
  Sono letture CUA delegate, non letture WhatsApp di questo owner.
- Ricevute private: `intake.partial.private.json`, `continuation.private.json`
  e inventario atomico `requirements.reconciled.private.md` nella directory
  privata preservata `output/tony/feedback-plan-20261113/`. L'inventario mantiene ogni annotazione; questo piano le
  raggruppa in unità consegnabili, senza riprodurre il testo privato in Git.

Copertura CUA storica: overlap 2026-11-10 13:35 e coda effettiva 2026-11-12
11:54 raggiunti, 19 incoming, 6 outgoing integrali, una outgoing parziale e un
segnaposto outgoing cancellato. Cronologia non continua: outgoing di aggiornamento
troncata ed eventuali messaggi non inclusi nell'estrazione restano non attestati.
Il pacchetto diretto risolve i materiali necessari al piano; non serve altro
retry CUA. Gli audio restano esclusi. Il child riferisce un focus involontario
sul composer senza testo o invio: non dichiarare composer mai toccato nell'intera
lettura delegata. Nessun invio o composer da questo owner.

La visita del capo il martedì successivo, citata l'2026-11-11, suggerisce il
2026-11-17 come contesto commerciale; **non è una scadenza concordata**.
Righe 84/45/48/90/32/34/56/89 e venerdì 23 sono esempi, non comandi né date reali.
La outgoing di aggiornamento parzialmente osservata non prova l'invio del testo
integrale/hash della bozza precedente: nessun reinvio o consenso riutilizzato.

## Baseline reale da preservare

Fetch origin riuscito il 2026-11-13: locale `6f82d22`, origin/main `175bde5`,
1 commit avanti / 0 indietro; differenza soltanto documentale. Nessun codice
successivo trovato nel confronto Git. Checkout modificato e `next-env.d.ts`
preservati, nessun pull/reset/stash. Non è una nuova verifica del runtime.

Ultima release Production verificata: `175bde5a11be53239efdc92cbb304f41070a5408`,
Vercel `dpl_5davwWgByxFDufgfYKGygipST8iS`,
`https://time-tracker-tony.vercel.app`. [Prove del 2026-11-10](intake-20261110-ai-assistant.md).

| Già presente | Limite concreto rispetto alle nuove richieste |
| --- | --- |
| Overview, report tagging, progress per livello, drill-down e Works to go. | Nuovo layout annotato, filtri vendor e report AI dedicati non completati. |
| Registro asset con aggiunta/modifica, livelli assegnabili e import CSV/JSON/XLSX canonici con preview. | Eliminazione individuale generalizzata assente; restore esistente limitato al proprio batch. Tag inline/bulk/copy/drag nuovi. Nessun import universale. |
| Ricerca AI su inventario completo, totale esatto, pagina fino a 20, link corretti. | Non è un tool per tagging filtrato, WTG, lookahead, vendor support o biblioteca cross-project. |
| Copilot con sette tool, proposte task titolo/descrizione/priorità e conferma separata. | Nessuna modifica schedule, creazione attività/task coordinata o lesson. Supervisor oggi incluso nei gate di management: nuova policy non già soddisfatta. |
| Programma gestito con ID, preview, CAS, audit, predecessori multipli, cicli rifiutati, baseline/actual preservati. | Motore Lun–Ven, FS/lag non negativo; non equivale ai calendari/relazioni P6. Token Copilot attuale vincolato allo stesso utente/sessione, non approval fra utenti. |
| P6 LHR11 conservato e consultabile: 16.969 attività, 36.923 relazioni, 13 calendari. | Sorgente non ricalcolata; AI vede solo conteggi metadata. Il limite gestito 15.000 e le semantiche diverse impediscono una conversione integrale implicita. Le due viste non si uniscono oggi automaticamente. |
| ACL server con membership/moduli; worker vede soltanto il proprio perimetro. | Ricerca corrente nel progetto attivo. “Tutti i progetti” non implica bypass membership, ruoli o accesso globale. |
| Provider attivo, meter metadata dedicato verificato in attivazione. | Token/costo Production null senza lettura collector; voce fisica/end-to-end Production non attestata. Nessuna nuova chiamata live per il piano. |

La QA delegata del 2026-11-10 su LHR11 attestava 1.354 asset, 0 task,
0 attività gestite e 16.969 P6 importate, ricerca/link PASS; non è lo stato di ogni
progetto né una nuova lettura dei dati. I conteggi AMS16 nei PNG sono storici.
Restano separati i vecchi residui: setup checksheet/firmatari e worker non
interamente collaudati live, mapping asset↔P6 e regole Health/sequenze non completi,
reload che tornava ad AMS16. Il nuovo piano non li cancella né ne presume la soluzione.

## Matrice completa: UI e registro

S/M/L indicano complessità relativa, non giornate: S = contratto invariato,
M = comportamento condiviso/validazioni, L = operazione dati, policy o modello nuovi.
**Durate e costi numerici: null**. Codex deve produrre proposta tecnica, prove e
stima sul perimetro di prodotto concordato; per R4 la stima segue lo spike descritto
sotto. Non viene chiesto a Marco di scegliere un'architettura non valutata.

| ID / fonte | Richiesta → risultato proposto | Già fatto / gap e prova di accettazione |
| --- | --- | --- |
| UI-01 · IMG1 | Header più basso, progetto sulla riga del titolo a desktop; riepilogo leggibile con meno padding. | S: riuso AppShell/Overview. Mobile ricompone senza tagliare progetto/azioni; zoom/tastiera/tocco verificati. Nessun cambio metriche. |
| UI-02 · IMG1/2 | UI dice Schedule; report subito sotto il riepilogo Overview. | S/M: rinominare copy/menu pertinenti, preservare ID e titolo originale del P6. Proposta: preview/ingressi ai report sotto il riepilogo, dettaglio completo riusabile, senza duplicare una seconda pagina Reports. |
| UI-03 · IMG2 | Quattro indicatori compatti attività/relazioni/calendari/WBS; spiegazione fonte sotto Info; matching inline dopo dipendenze. | S: stessi dati, meno spazio. Informazione tecnica accessibile con tastiera e touch; fonte/revisione restano riconoscibili. |
| UI-04 · IMG2 | Chiarire Go to page dates e Dependencies. | S: proposta copy “Show dates for these activities” e “Show dependency links”, breve spiegazione e stato esplicito. Provare che il primo centra le date delle righe correnti e il secondo mostra/nasconde frecce, senza cambiare legami. |
| UI-05 · IMG2 | Preferire giorni e poter nascondere/mostrare la durata/ore dalla testata. | M: toggle di visibilità semplice; giorni solo da unità/calendario sorgente attestati. Nessuna divisione fissa per 8 o 24. Se dato non derivabile, ore salvate e limite esplicito; calendario/date originali invariati. |
| UI-06 · IMG4 | Nome assistente più chiaro, helper/esempi dietro Info, titolo Prepare task change non duplicato. | S: proposta “Project assistant”, senza affermazione legale sul marchio. Conservare esempi accessibili e avvisi utili alla decisione, stato provider, progetto e conferma umana; funzione manuale intatta. |
| UI-07 · IMG5 | Overdue dentro Schedule come vista/opzione, via la voce autonoma nel menu. | M: preservare ricerca, filtri, pagine, permessi e vecchio deep link; indicare la popolazione task/attività gestite, senza presentarla come tutte le attività P6. Contatori/lista concordanti e navigazione di ritorno corretta. |
| AS-01 · IMG6 | Registro anagrafico distinto dal Tagging status report; nome asset primario, riferimento progetto leggibile, filtri in testata colonna. | S/M: riusare aggiunta/edit; ID tecnico stabile in dettaglio/copia/link, non dominante. Riutilizzare clientAssetId solo se semanticamente equivalente al riferimento richiesto. Mobile usa filtro compatto accessibile con lo stesso stato. Il report conserva link ad asset/test. |
| AS-02 · IMG6 | Aggiungere, modificare ed eliminare dal registro; import nei formati richiesti. | M/L: aggiunta/edit esistono, serve renderli reperibili; delete nuovo e con preview dei riferimenti. Prima versione: bloccare eliminazione referenziata mostrando task, figli, checksheet, WTG e programma interessati; niente cascata silenziosa. CSV/JSON/XLSX già supportati, altri formati solo da esempi concreti/whitelist, non promessa “tutti”. Preview/merge/versioni e vecchi metadati preservati. |
| AS-03 · IMG6 | Tag in colonne con checkbox; copy/paste e trascinamento su asset simili. | L nel comportamento: checkbox = applicabilità/configurazione, non esito/approvazione. Prima edit singolo e “Copy tag selection to selected assets” con diff/numero target; poi gesto drag come scorciatoia, mai unica modalità. Non copiare ID, risultati, firme o storico; clone asset e copia tag distinti. Blocco rimozione livelli referenziati, CAS e recupero coerente da conflitti/errori. |
| AS-04 · IMG6 | Duplicare/aggiungere un asset dello stesso tipo tramite copy/paste, distinto dalla sola copia tag su asset già esistenti. | M/L: nuovo identificativo tecnico, riferimento progetto da validare e idempotency key. Anteprima dei soli campi anagrafici/configurazione selezionati; nessun riuso di ID, firme, evidenze, esiti, completamenti o legami al programma senza scelta esplicita. Un retry crea un solo nuovo asset; l'originale resta intatto. |
| RP-01 · IMG3 + U1 | Report tagging gerarchico equipment/asset, livelli/step, stato, percentuale e issue. | M: EquipmentStatusMatrix/tag progress sono base parziale. La reference illustra l'organizzazione, non impone ogni pixel/codice o i numeri del mock. Gruppo espandibile, totale/popolazione dichiarati, percentuale e issue aprono le fonti. N/A, assente, test e review separati. |

## Matrice completa: assistente, programma e conoscenza

| ID / fonte | Richiesta → comportamento da costruire | Dipendenze e accettazione |
| --- | --- | --- |
| AI-01 · U1/U2/U3 | Report tagging progetto; restringere per vendor, livello, late; riepilogo vendor nominato. | RP-01 + contratto vendor/stato. UI e tool interrogano lo stesso read model. Sequenza report→vendor→L3→late conserva filtri strutturati visibili, totale esatto e link alla stessa popolazione; reset/cambio progetto espliciti. Livelli solo configurati/applicabili. |
| AI-02 · U4 | Works to go per vendor o disciplina. | Lista oggi ha stato/testo; nuova query condivisa. Risolvere attributi da link espliciti o campo proprio, con non classificati/conflitti separati. Nessun uso dei task aperti come surrogato di WTG; totale, pagina e report concordano. |
| AI-03 · U5 | Attività delle prossime due settimane. | Lettura P6 indicizzata e programma gestito distinti. Proposta minima: date salvate, finestra esplicita di 14 giorni inclusi oggi, ongoing sovrapposte incluse; overdue e senza data separati. Fonte/revisione/timezone dichiarate. Non un nuovo motore predittivo o ricalcolo P6. |
| AI-04 · U6, 2026-11-10 21:43:11 | Vendor necessari a supportare le attività della stessa finestra. | AI-03 + relazione verificata attività/asset↔vendor. Elenco vendor con attività/date e provenienza, copertura/mapping mancanti quantificati. Vendor ≠ manufacturer ≠ contractor ≠ azienda dell'assegnatario senza regola; non inferire disponibilità, prenotazione o impegni commerciali. |
| AI-05 · U7/U8 + U-PERM | Linguaggio naturale per spostare e collegare le attività reali dello Schedule LHR11 osservato da Tony, predecessori/successori multipli, approvazione. | Codex deve dimostrare il contratto selettivo/versionato sui record importati con lo spike R4, non limitarsi a nuove attività app scollegate. Riga visiva risolta a ID stabile + snapshot; se “move” è ambiguo fra ordine/date, chiedere nel flusso. Grafo e riferimenti interni/esterni conservati. Draft→preview diff/effetti a valle→conferma autorizzata→CAS/audit; cicli, self-link, ID mancanti, actual/baseline e calendari protetti. Nessuna write dal modello. |
| AI-06 · U9 | Attività per Asset ID con deadline e presenza nello Schedule. | AI-05 + contratto oggetti: attività programma, task esecutiva e tag non sono sinonimi. Anteprima unica di oggetti/link/data completa; server genera ID, salva atomicamente/idempotentemente e mostra il record nella vista giusta. Nessun worker assegnato per supposizione, record orfano, metà operazione o doppione su retry. |
| GS-01 · T1112-1154 | Colonna Gantt con % e semaforo: verde puntuale/completato, arancio residui, rosso missed/late, neutro prima della scadenza. | Contratto percentuale, date e precedenza stati + mapping ai tag. N/A/senza task/senza data/senza mapping ≠ 0% o verde. Testo/percentuale e spiegazione oltre al colore; colori livelli separati da colori stato. Stesso calcolo del report, righello/scroll/parità Gantt preservati. |
| KB-01 · T1111-1507 | Info asset e ricerca issue di altri progetti, lessons learned. | Prima biblioteca in lettura dei soli progetti consentiti; chiave composta progetto+asset, provenienza/link visibili, nessun merge per nome. Poi lesson curata distinta da note/issue, con autore/versione/fonte/visibilità. ACL prima di conteggi/facet/snippet; revoca membership/moduli invalida risultati. Nessuna nuova condivisione globale o embedding/provider impliciti. |

Tracciabilità all'inventario privato: OV01–03→UI-01; OV04/CP01→UI-02;
SC01–03→UI-03; SC04–05→UI-04; SC06–07→UI-05; AI01–04→UI-06;
SC14–15→UI-07; AS01/06/07/08→AS-01; AS02–05→AS-02;
AS09–12→AS-03 e AS11→AS-04 per la distinta duplicazione asset;
RP01→RP-01; AI05–09→AI-01; AI10–11→AI-02; AI12→AI-03;
AI13→AI-04; AI14–17/PM01→AI-05; AI18–20→AI-06;
SC08–13→GS-01; KB01–03→KB-01. Copertura verificata degli atomi,
nessun requisito perso nell'accorpamento; ricevuta privata `requirements-coverage.private.json`.

## Sequenza di consegna raccomandata

| Incremento | Risultato dimostrabile | Dipendenze / uscita |
| --- | --- | --- |
| R1 — UI e orientamento | UI-01/02/03/04/06, AS-01; toggle visibilità durata e UI-07 compatibile con deep link. Dashboard più utile subito, assistente con meno testo. | Solo contratti esistenti; non aspettare vendor o NL schedule. Mostrare prima/dopo desktop/mobile e percorsi chiave. Giorni derivati esclusi finché il dato non è attestato. |
| R2 — Tagging e registro | RP-01 + AS-03 edit singolo e copy-to-selection sicuro; definizione stato/percentuale e fonte vendor. | Separare anagrafica da report. Un solo contratto calcolo/filtri; dati mancanti visibili. Delete guardato AS-02 e clone AS-04 sono sottolotti distinti; non bloccano il report. Drag e nuovi formati solo dopo che il flusso base è provato. |
| R3 — Assistente utile sui dati | AI-01/02, poi AI-03 e AI-04. Gli stessi report si aprono dalla risposta e dalla dashboard. | F04 vendor e fonte/mapping attestati sono dipendenza reale dei casi vendor U2/3/4/6; F05 disciplina governa U4. Lookahead U5 può procedere sui dati calendario esistenti. Mancanti visibili consentono una prova del limite, non una consegna completa del report vendor. |
| R4 — Schedule reale LHR11 e conferme | Prima spike e contratto/prova su attività importate esistenti; poi AI-05 e AI-06 nella stessa vista/versione di lavoro. GS-01 appena mapping/formula sono pronti. | Rollout di prodotto e F03 ruoli; proposta tecnica e stima responsabilità Codex. Grafo, calendari, riferimenti e fonte P6 conservati; policy server unica per tool/edit/import. Non è soddisfatto creando solo nuove attività app fuori dallo Schedule che Tony vede. |
| R5 — Biblioteca riusabile | KB-01 lettura federata; poi lessons curate con salvataggio esplicito. | Può avanzare indipendentemente da R4 dopo contratto ACL/identità; niente grant o copie globali. |

GS-01 non deve attendere tutte le funzioni R4: dipende da contratto stato/mapping,
non dal parser naturale. Le due settimane sono prospetto da dati salvati prima
che previsione ricalcolata. Per un'eventuale demo ravvicinata, privilegiare R1 e
un report end-to-end R2/R3 completo; non mettere in scena modifiche AI non verificate.
Non viene fissata una consegna al 2026-11-17 senza scelta di Marco.

### R4: proposta tecnica e prova prima di stimare il rollout

L'esito di prodotto atteso è operare sulle **attività LHR11 già importate che
Tony sta guardando**: identificarle, proporre lo spostamento/legame e, nel rollout
di scrittura autorizzato, ritrovare il cambiamento confermato nella stessa vista.
Creare soltanto nuove attività nel programma app separato non soddisfa U7/U8.
U9 deve a sua volta inserire il nuovo record nel programma di lavoro pertinente.

Codex deve eseguire, nel successivo incarico tecnico autorizzato, uno spike
circoscritto prima di dichiarare fattibile o stimare le mutazioni. Output:

1. Contratto selettivo e versionato tra fonte immutata e vista di lavoro, con
   identità `(progetto, hash fonte, internalId)`, campi/operazioni supportati e
   risoluzione dei numeri di riga sulla vista corrente. Valutare overlay/patch
   versionata o proiezione selettiva senza copiare l'intero P6 nel motore gestito.
2. Prova offline sui record LHR11 conservati: 16.969 attività oltre il limite
   gestito 15.000, legami anche oltre il sottoinsieme selezionato, tipi/lag e
   calendari differenti. Nessuna troncatura, perdita di archi/riferimenti o
   conversione fissa ore/giorni; baseline/actual e sorgente restano intatti.
   Gli impatti a valle richiedono il contesto del grafo pertinente, non soltanto
   le righe selezionate. Operazione non supportata: rifiuto motivato e nessuna
   applicazione parziale, non simulazione di un ricalcolo P6 equivalente.
3. Anteprima verificabile di spostamento e predecessori multipli su ID reali,
   con differenze e impatti dichiarati; proposta di persistenza/rollback/audit
   della revisione di lavoro e coesistenza visibile fonte/lavoro. Dopo queste
   prove, Codex presenta soluzione raccomandata, limiti e stima in intervallo
   con base e confidenza, prima del rollout di salvataggio.

Marco sceglie **perimetro e rollout di prodotto**, per esempio anteprime sulle
attività esistenti prima, poi date/dipendenze confermabili e infine U9. Non deve
scegliere fra overlay e conversione, risolvere il limite numerico o progettare
il motore. Spike e prove qui sono pianificati, non eseguiti in questa analisi;
nessuna conversione integrale o scrittura P6 già pronta viene promessa.

## Tre decisioni critiche, con raccomandazione

1. **F04 — significato e responsabilità vendor.** Vendor indica chi fornisce
   l'equipment o chi esegue/supporta l'attività? Raccomandazione per U6: soggetto
   di supporto esplicitamente associato all'attività; fornitore/fabbricante restano
   distinti. Marco conferma il significato di prodotto e chi valida l'attribuzione;
   Codex propone fonte/campo/mapping dai dati disponibili, senza inventare nomi.
   È una dipendenza visibile di U2/3/4/6, non una semplice scelta di filtro.
2. **F01 — percentuale e precedenza dei colori.** Raccomandazione: progresso dai
   passi obbligatori applicabili superati, con firme/review/WTG separati;
   rosso ritardo prima di arancio residui, poi verde completato puntuale.
   Alternativa: percentuale dei livelli approvati con etichetta distinta.
   I casi concreti sotto rendono la scelta verificabile, senza un unico flag
   che certifichi test, approvazione e assenza di residui.
3. **F03 — chi approva una modifica allo Schedule LHR11?** Admin soltanto oppure
   anche manager. Raccomandazione per il
   primo incremento: admin/manager confermano esattamente il proprio draft, se
   questa è la regola voluta; supervisor resta proponente senza nuovo diritto di
   salvataggio. Se invece serve passaggio obbligatorio a un altro approvatore,
   progettare la coda durevole e la relativa audit trail, senza fingere che il
   token attuale supporti già l'approvazione fra utenti. Nessuna applicazione
   di questa proposta ai ruoli prima della decisione.

Scelte minori già proponibili senza un questionario: “Project assistant” come
nome; Schedule come copy; Reports sotto summary con preview e collegamenti;
copy-to-selection prima del drag; whitelist import attuale, estensioni da file
concreti. Per biblioteca assumere inizialmente soltanto i progetti già accessibili,
issue alla fonte e lessons curate distinte; condivisione oltre membership rinviata
a scelta specifica. “All formats” sarà specificato per whitelist nel sottolotto.
Clone asset e copia tag hanno contratti/prove separati, non un gesto ambiguo.

Il [form precompilato](../../decision-intake/2026-11-13_tony-feedback-plan_decision_form.md)
distingue le tre decisioni business **F04/F01/F03**, le scelte future di rollout
e i vincoli/proposte tecniche affidati a Codex. Non sono sedici approvazioni per
partire con R1: ACL invariate, ID nuovi per le copie, nessuna copia di firme/esiti
e whitelist import attuale sono guardie tecniche da rispettare. Marco risponde
in chat; Codex sincronizza. Nessun nuovo lock è inventato per queste guardie,
nessuna approvazione per silenzio e nessun mandato funzionale acquisito ora.

Ipotesi concreta per discutere F01, **non formula già approvata**: progresso
passi = requisiti obbligatori applicabili con esito superato / requisiti
obbligatori applicabili, escludendo solo N/A espliciti; firme e approvazione
restano indicatori separati. Non è la percentuale di risposte compilate, né la
percentuale di livelli approvati oggi già disponibile. Se l'obiettivo è invece
quest'ultima, riusare quel calcolo con etichetta esplicita, senza chiamarlo passi.

Per il colore operativo, proposta di precedenza da approvare: rosso se mancato
o completato oltre la data autorevole; altrimenti arancio se completato con WTG
aperti; altrimenti verde se completato puntualmente, anche in anticipo; neutro
se ancora non completato e non scaduto. Scadenza oggi non è già late. Dato ignoto,
senza data o mapping ha etichetta distinta, non il neutro di un'attività futura.
Questa proposta risolve esplicitamente il conflitto rosso/arancio e il caso
completato prima della scadenza, anziché attribuire queste decisioni a Tony.

## Ownership, accessi, costi e prove

Owner centrale definisce i contratti e integra. Parallelismo per file, dopo il
contratto, senza due writer sullo stesso modulo:

| Responsabilità | File principali / collisioni da evitare |
| --- | --- |
| UI shell/Overview/navigazione | AppShell.tsx, Overview.tsx; un solo owner include anche etichette menu. |
| Dominio dati/report | commissioning.ts, tag-progress.ts, checksheets.ts ed eventuale read model dedicato. Un solo owner di schema/merge/identità e repository; non tre calcoli per UI/AI/Gantt. |
| Registro e bulk | CommissioningWorkspace.tsx, asset-register.ts, commissioning-import.ts e handler dedicati, coordinati con l'owner dominio. |
| Assistant adapter | lib/copilot.ts, server/copilot.ts, CopilotWorkspace.tsx; un solo owner dei tool condivisi. Trasporto/provider non si cambia per un semplice report. |
| Programma/proposte | scheduling.ts, ScheduleWorkspace.tsx, SourceProgrammeWorkspace.tsx/Gantt e servizio proposta; writer centrale di CAS/audit/handler. |
| Biblioteca | Servizio/proiezione dedicati; riusare scopeData e membership, senza contendere repository.ts o copilot.ts con altri writer. |

Le due review indipendenti di supporto hanno letto codice/contratti e preparato
rapporti privati; nessun edit funzionale o test live. Guide Next locali e
Impeccable/craft-floor da applicare al momento degli edit, non nuova UI ora.

Prove per incremento, senza ripetizioni indiscriminate:

- **R1:** confronto dei sei riferimenti pertinenti con desktop/mobile, zoom,
  tastiera/tocco, nome lungo e progetto vuoto; helper consultabili, nessun overflow,
  link vecchi compatibili e stessa popolazione/metriche. Lint/typecheck/build del
  lotto; nessuna nuova suite di test che rispecchi soltanto etichette o padding.
- **R2/R3:** unitari su popolazioni/filtri, late oggi vs ieri, assenti/N/A/legacy,
  vendor ignoto e conflitti disciplina; API autorizzate contro progetti/ruoli,
  provider finto per casi U1–U6 e successive restrizioni. Totali/pagine/export/link
  riconciliati con il report; niente XER intero nel prompt. Lookahead testa confini
  data/timezone, ongoing, undated e source/managed separati.
- **Registro:** differenza anteprima uguale ai record salvati, target espliciti
  anche con filtri/pagine, non copia risultati/firme, livello referenziato bloccato,
  delete referenziato rifiutato; retry/CAS e import parziali preservano dati.
- **R4:** U7–U9 con ID stabili, ambiguità data/righe, cicli e impatti a valle;
  payload alterato, revoca, timeout, token scaduto e versione cambiata non scrivono.
  Stessa policy su UI/API/import; task+schedule atomici senza doppioni/orfani;
  actual/baseline, inventario, record e assegnazioni preesistenti intatti.
- **R5:** due progetti con ID/nome asset uguali restano distinti; progetto non
  consentito assente anche da totali/snippet/facet e allegati, revoca tra ricerca
  e apertura gestita. Nessuna nota privata promossa a lesson condivisa.

Tutti i nuovi tool restano bounded e project/permission scoped; testo cliente,
asset, issue e lesson sono dati non istruzioni. Niente Autopilot. L'attivazione e
riuso chiave del 2026-11-10 sono già risolti: non richiedere nuovi segreti o
ripetere quei gate. Eventuali nuove strutture/migrazioni richiederanno un piano
esatto del relativo incremento, non un generico nuovo accesso al DB. In questa
fase nessuna scrittura remota è autorizzata/eseguita.

Costi provider: riusare tool deterministici e output paginati, limiti di round/
byte/timeout e meter esistenti; non alzare budget o introdurre embedding per la
biblioteca. Stima monetaria null finché non c'è volume/model usage misurato;
qualunque verifica live futura va distinta dai test sintetici autorizzati.
Quota conto nativa all'avvio 9% usato, ordinary allowed; cap90/stop nuovi85
invariati, nessun reset/acquisto; non è consumo attribuito al job.

## Chiusura della pianificazione

Documento e fonti pronti per discussione con Marco. Primo incremento raccomandato
R1, con specifica di R2 in parallelo; R3 sui contratti condivisi, R4 dopo decisioni,
R5 indipendente. Stime temporali/costi restano null, confidenza alta sul delta UI
visibile e sui limiti del codice, media sulle scelte di interazione proposte,
non definita sulle regole di dominio ancora da approvare.

Nessun altro accesso WhatsApp necessario per questo pacchetto, nessuna promessa di
sorveglianza continua. Il monitor ristretto esistente resta un incarico separato.
