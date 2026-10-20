# Analisi mail Tony - batch20ott2026

Analisi dei **7/7 allegati** completata localmente; nessun file bloccato.
Le quattro mail sono contesto trasmesso dalla regia, distinto dalla lettura
indipendente dei file. Il mandato umano di elaborazione è stato verificato nella
regia, messaggio `01a15861-e4a0-79f3-8cb0-c867359b0ede`. Non abbiamo riaperto la
casella mail né usato riassunti Gemini. Riferimenti cliente, nomi, testi, immagini,
righe e ID delle attività restano nei rapporti privati ignorati da Git.

Incarico `tony-mail-context-analysis-20261020`, richiesta
`tony-mail-context-analysis-request-20261020`, scadenza20ott. Owner unico questa
chat; publisher della regia separato. Nessuna scrittura su richieste/eventi o
callback interchat da questo esecutore. Nessuna lettura WhatsApp necessaria.

## Risultati che cambiano il quadro

- Il signoff richiede risposte ai controlli, prove, gestione delle NC, decisione di
  readiness e approvazioni distinte. Una issue aperta non autorizza automaticamente
  il passaggio. Il catalogo required/optional già locale non copre questo workflow.
- Il programma XER è leggibile, ma supera il limite quantitativo del JSON import
  esistente e contiene semantiche che il motore locale non rappresenta. Una
  conversione diretta perderebbe informazione; non è stata preparata o eseguita.
- L'Excel a due fogli presenta due viste delle stesse attività: sommare le righe
  duplicherebbe il programma. MPX ed Excel associato presentano differenze di date
  e mancano di una chiave comune verificata per un join automatico senza perdita.
- Il deck aggiunge riferimenti di reporting, non formule, dati ACC interrogabili
  o un mandato ad attivare un provider AI. Alcune viste sono simili alle foto già
  lette su WhatsApp; identità delle immagini non attestata.

## Inventario e copertura

Identificativi MAIL20 riferiti al solo batch mail, distinti dagli ATT WhatsApp.
I29originali WhatsApp già verificati restano29; questi sono7input locali separati.
Hash originali ricalcolati a fine lettura e invariati. Nessuna esecuzione di macro,
formule, oggetti incorporati o istruzioni nei file.

| ID        | Mail | Formato e copertura                                     |     Byte | SHA256                                                             |
| --------- | ---- | ------------------------------------------------------- | -------: | ------------------------------------------------------------------ |
| MAIL20-01 | A    | MPX testuale, cp1252;5121recordtask,3708con durata      |  2480018 | `6863d49cdfe11b6aef3df8c07c7a1bde7ef5b74651c55ea9b6a3097403937692` |
| MAIL20-02 | A    | XLSX OOXML;1foglio A1:I4845;3708attività+1136gruppi     |   282225 | `b63433230a33007f210e034afc678f1c12dea869ab76e3907f41a29cb746c03e` |
| MAIL20-03 | A    | PDF1.7;9pagine                                          |  6503071 | `b3b41043e6a66ffbc317187972949a8299821a9953f96d78dd141976dd5194b1` |
| MAIL20-04 | A    | PDF1.3;21pagine                                         |  1427321 | `a6b76ec748214f9059692fd9fc347bf5af2b22c56fa9ce9029f6950efb1f0bf6` |
| MAIL20-05 | B    | XLSX OOXML;2fogli A1:K8578/A1:M8473;5453attività uniche |   877009 | `70a9caaf09d2ed5649093e38f90fc8dfb725a1301e6a4de25b80ffa8529fca34` |
| MAIL20-06 | C    | PPTX OOXML;8slide16:9,8bitmap                           |  1138091 | `ad7a67e7dd611ec3e4a449f90611c828f87b96b498764ebbbe8257e39df742f8` |
| MAIL20-07 | D    | PrimaveraXER;1progetto,16969attività,3073WBS            | 23590083 | `8e0b1b7766212b85457a3abec2c6ac83e6e1379ff916e6a0ddf138b6542111b5` |

MPX/XER: parsing strutturale completo, con riferimenti riga/campo conservati nel
rapporto privato; nessun ricalcolo del motore P6. Tre fogli Excel letti, zero
formule presenti, nessuna macro eseguita. PDF: tutte30pagine estratte/renderizzate
ed esaminate, OCR locale supplementare del form raster. PPT: tutte8slide,
8bitmap originali e8render esaminati, senza apertura PowerPoint o cloud.
La parte sotto il bordo del commento AI nella slide8 non esiste nel bitmap e
rimane non verificabile.

## Matrice fonti, requisiti e copertura applicativa

Stato riferito al codice locale esaminato, non a un nuovo collaudo di produzione.
P = presente, parziale = copertura incompleta, assente = non implementato,
non verificabile = la fonte non consente quella conclusione.

| Fonte / requisito                                                    | Stato nell'app            | Prova e limite                                                                                                                         | Prossimo passo / owner                                                                            |
| -------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A1/A2 e B5: Programme ID e Activity ID distinti                      | Presente                  | Contratto identificativi, `scheduleSchema`, `task.cx.activityId`, link asset principale/consegna/livello                               | Preservare ID e crosswalk fonte, non rifare CX-010 / eventuale esecutore import                   |
| A1/A2/B5/D7: WBS, task, asset e quality tag                          | Parziale                  | Asset/parent/livelli e qualityTag esistono; WBS nativo e crosswalk sorgente no                                                         | Definire gerarchia e relazioni esplicite per dataset / Marco con Tony, poi esecutore              |
| A1/A2/B5/D7: date, dipendenze, progress, risorse/calendari           | Parziale                  | Gantt e baseline persistenti; solo FS, lag intero nonnegativo, lun-ven, durata positiva; risorse e calendari P6 non modellati          | Preflight che preservi campi e segnali incompatibilità / esecutore solo dopo mandato              |
| D7: proposta altro progetto di prova                                 | Assente per questo file   | XER analizzato, nessun progetto creato o import.16969attività contro massimo15000; parser MPX/XER nativo non presente                  | Scegliere obiettivo/perimetro e target solo per eventuale prova autorizzata / Marco               |
| A3/A4: risposte per requisito e prova pertinente                     | Assente per singolo passo | Catalogo5cd5ca9 e allegati task presenti; nessuna istanza check-sheet multipasso versionata                                            | Contratto step/risposta/prova/applicabilità / Marco-Tony poi esecutore                            |
| A3/A4: issue/NC da risposta negativa                                 | Parziale                  | Issue con asset/attività/livello e conteggi conformance; niente link stabile requisito→NC, classificazione CQV, gate e firme richieste | Separare tracciamento, blocking, readiness, approval / responsabile processo da designare         |
| A3/A4: signoff provvisorio/finale                                    | Assente                   | Review I/R/AC/A separata dal risultato già presente, ma non copre firme e decisioni del riferimento                                    | Validare revisione e ruoli prima del workflow / Marco-Tony                                        |
| A3/A4: documenti richiesti per progetto/fase/livello                 | Presente solo locale      | Catalogo5cd5ca9 con audit/permessi; required/optional non è esito Yes/No/N/A o prova accettata                                         | Riutilizzare la lista come configurazione, senza dichiarare signoff consegnato / esecutore        |
| C6: overview, filtri, Gantt, serie planned/forecast/achieved e issue | Parziale                  | Dashboard/tagTimeline/tagSummary e drilldown esistono; formule e cardinalità del deck non disponibili                                  | Concordare definizioni metriche prima di estendere report / Marco-Tony                            |
| C6: histogram, calendario e punctuality issue                        | Non equivalente attestato | Screenshot mostrano viste ulteriori rispetto al catalogo10foto; non provano editing o semantica P6                                     | Registrare riferimenti, non copiare calcoli dai pixel / backlog                                   |
| C6: provenienza ACC e commento AI                                    | Non verificabile          | Solo dichiarazione mail e screenshot. Nessun PBIX/DAX/API/record sorgente, provider o diritto di accesso                               | Nessuna integrazione/AI da attivare da queste fonti / mandato distinto se richiesto               |
| Richiesta storage già WhatsApp, rafforzata dalle prove nei PDF       | Parziale                  | Allegati task/tag autenticati con audit, PNG/JPEG/WebP/PDF2MB e20file; payload nel DB                                                  | Piano storage/retention/permessi e prova per step, nessun provider attivato / Marco poi esecutore |

Evidenze codice: `src/lib/commissioning.ts` (asset/schedule/cx/catalogo,
`isTagApproved`, `tagTimeline`), `src/lib/scheduling.ts`,
`src/lib/commissioning-import.ts`, `src/lib/permissions.ts`,
`src/server/commissioning.ts` (generate-tags), `src/server/handlers.ts`
(upload/getAttachment), `src/server/db/schema.ts`, `TaskDetail.tsx`,
`CommissioningFields.tsx`, `DocumentRequirements.tsx` e
[contratto identificativi](../programme-identifiers.md).
Nessun parser MPX/XER nativo individuato nelle sorgenti applicative.

## Programmi: compatibilità reale

MAIL20-01 usa record numerici MPX:5121record70,3708con durata e1413outline.
Le relazioni estratte includono FS/SS/FF/SF e un lag negativo; presenti calendari,
risorse e assegnazioni. La numerazione interna MPX non è un Activity ID P6 provato.
MAIL20-02 contiene3708righe attività e1136gruppi, con colonne Activity ID e date;
non tutti i valori MPX sono conservati e i nomi ripetuti impediscono deduplica
per titolo. Confronto normalizzato nei privati, non autorizzazione a unire i file.

MAIL20-05: due fogli, ciascuno5453attività con lo stesso insieme di Activity ID,
nomi e durate coincidenti. Le date rappresentate come stringhe marcate e seriali
coincidono a livello giorno nei confronti fatti; i campi phasing/comments hanno
contenuto diverso e non vanno sovrascritti tra viste. Dipendenze, ore e risorse
non sono ricostruibili dal solo riferimento alla catena mail storica.

MAIL20-07:1progetto,16969TASK,3073WBS,36923relazioni,13calendari nell'inventario
(9usati dai TASK),60risorse e27834assegnazioni. Le relazioni includono SS/FF/SF,
3codici non riconosciuti, lag negativi, coppie ripetute e6attività con più di
100predecessori. Attività milestone/zero durata e calendari non standard non
sono rappresentabili dal modello corrente senza scelte esplicite.
Il limite import15000 è superato di1969attività, indipendentemente dall'assenza
del parser. Non troncare o spezzare il progetto ignorando i legami.
Percentuali durata P6, physical %, stato completato, review tag e conteggi
conformance sono concetti distinti. Non convertirli in una percentuale unica.

Le date della catena2024 e i dati storici/esempio nei programmi non diventano
scadenze correnti. Nessuna data fine L3 è stata ricavata dal riassunto Gmail.
Le assegnazioni risorsa non autorizzano la creazione di utenti/account.

## Signoff: cosa è già definito nelle fonti

Form9pagine:35risposte Yes/No/N/A tutte vuote, con riferimenti/allegati, punchlist,
conclusione e firme operative non compilati. Le approvazioni del frontespizio
riguardano il modello, non il completamento di un impianto.
Istruzione21pagine:Draftv2.2, mentre il form riportaEffectivev2.0. Inventariate
299righe tecniche marcate nelle colonne MC/startup, incluse ripetizioni e righe
composte. Non sono299passi MC applicabili né299test eseguiti.

Ogni riga richiede risposta Yes/No/N/A; No porta alla punchlist/NC con
responsabilità, scadenza, classificazione blocking/nonblocking e chiusura.
La fonte distingue: tutti requisiti soddisfatti; sole NC nonblocking con approval
provvisoria; NCblocking con avvio CQV non autorizzato. Anche una firma provvisoria
nel terzo caso non è via libera. Prova allegata, accettazione della prova,
readiness e firma sono stati distinti.
Riferimenti interni/sezioni e una funzione firmataria differiscono tra i modelli:
non costruire regole automatiche su quei rimandi senza riconciliazione.

## Mappa dei concetti e ipotesi

La catena proposta è progetto/programma/revisione e WBS, Activity ID, asset e
quality tag/livello, task/scheda, passo versionato, risposta/prova, NC collegata,
classificazione/readiness e approvazioni provvisorie/finali con audit.
Sono già persistenti Programme/Activity ID, asset, link al livello e task/tag.
WBS, istanza multipasso, legame step→NC e gate/firme restano da modellare.

Un gruppo WBS non è automaticamente un asset; il nome di un'attività non è una
chiave affidabile. I programmi e i PDF non provano di appartenere allo stesso
progetto. Nessun collegamento automatico fra dataset differenti. Le corrispondenze
L3/L4-colore differiscono tra programmi e materiali precedenti: configurazione
per progetto, non mappa universale. Il PDF non assegna da solo un livello L1…L6
alla sua accettazione. Required/optional del catalogo non equivale a Yes/No/N/A.

## Delta backlog e ordine proposto

Già fatti: CX-010identificativi, Gantt persistente, asset/tag e taskcollegate,
review distinta, allegati/audit, filtri Area/Phase, home per ruolo, colori per
progetto e catalogo documenti locale. Nessun motivo per rifarli dal batch.
Le nuove fonti rendono più preciso CX-011: non basta una lista documenti,
servono risposte/prove per requisito, eccezioni con responsabilità e gate separati.
Aggiungono un contratto import da definire per WBS/calendari/relazioni/risorse,
un rischio duplicati tra viste e metriche di report ancora prive di formula.

Ordine proposto per incarichi successivi, nessun lotto avviato:

1. Marco/Tony scelgono revisione autorevole e regole di applicabilità/NC/readiness,
   usando i conflitti documentati. Esecutore prepara poi il contratto multipasso,
   preservando risultato test e review già distinti.
2. Esecutore, su mandato, prepara un preflight reversibile di un solo programma
   scelto, conservando gli ID e tutte le incompatibilità. Prova locale sintetica
   o report privato precedono qualsiasi piano di import reale; target remoto
   richiederebbe autorizzazione separata e le garanzie DB già previste.
3. Marco delimita volumi, tipi file, retention e permessi storage per le prove.
   Nessun costo, servizio o migrazione impliciti.
4. Definite le metriche, esecutore confronta i report con i record sottostanti.
   Screenshot/AI commentary non sostituiscono definizioni o fonti verificabili.

Decisioni necessarie solo prima dello sviluppo/import: revisione e gate di signoff;
programma pilota e fedeltà richiesta; perimetro storage. Nessuna nuova domanda a
Tony o sulle credenziali necessaria per completare questa analisi.

## Lettore, prove e limiti

Rapporto privato completo e navigabile:
`output/tony/mail-batch-20261020/report.private.md`; inventario originale e rapporti
specialistici nella stessa cartella. Il reportmetadata `regia-status.json` espone
il riferimento locale al publisher già incaricato. Nessun nuovo sito, UI o
navigazione della regia, nessun upload cloud. Questi privati non entrano nel backupGit.

Delega reale: `/root/mail_schedules20` (schedule,Sol6.1xhigh),
`/root/mail_signoff20` (PDF,Sol6.1medium), `/root/mail_ppt20`
(PPT,Sol6.1medium), parent `/root` per integrazione e verifica centrale.
Modelli/effort sono quelli richiesti nelle chiamate di spawn, non misure di consumo.

Verifiche: inventario7/7, SHAoriginali invariati, copertura strutturale e visiva sopra,
confronto statico codice, JSON/report/link e diff del commit documentale.
Nessuna suite applicativa, test autenticato, import o scrittura DB effettuati.
Nessun provider/AI live, invio o deploy. next-env.d.ts e modifiche preesistenti
preservati. SSH già fallito, nessun nuovo fetch/push per questo batch.
