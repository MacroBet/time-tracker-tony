# Attuazione del piano Tony — 16 novembre 2026

## Mandato e limiti correnti

Marco ha approvato l'intero piano A1–A8, delega parallela e commit progressivi,
nel messaggio umano `01a1e5cb-1f3d-7ba3-8e22-e8a011404eb3` della regia,
turno `01a1e5cb-1cbf-7ae3-a539-239a95baed33`. Job manuale
`tony-plan-implementation-20261116`, richiesta
`tony-plan-implementation-request-20261116`, deadline non concordata.

Dashboard: approvati default condivisi di progetto e preferenze personali
separate, usando i KPI esistenti. Le sei/sette colonne sono un'ipotesi operativa
del piano. Marco chiarisce che oggi non sono arrivati messaggi vocali: la traccia
AAC interna al video rimane non trascritta, senza costituire un blocco o una nuova
richiesta di analisi audio. Le immagini e il video già esaminati sono ricondotti
alla [matrice dei requisiti](intake-20261116-complete-analysis-plan.md);
nessuna riacquisizione a stato invariato.

Lavoro corrente: implementazione, test isolati e commit locali. L'estensione a
push/deploy remoti è stata rifiutata dalla revisione automatica nella regia prima
di arrivare all'esecutore: il rilascio richiede approvazione specifica sul risultato
concreto. Nessun consenso storico viene riutilizzato per aggirare questo limite.
Nessun DB remoto/import reale, provider o API a pagamento, nuovo segreto o servizio,
invio cliente o Autopilot. La criticità P6 salvata precede l'eventuale motore CPM
di lavoro, che rimane un incremento condizionato al proprio contratto.

## Monitor fermato

Unica verifica conclusiva CUA, senza focus/composer/invio: anteprima uscente Tony
con il testo esatto indicato da Marco, ore19:49 Europe/Rome. La regia ha impostato
nativamente l'automazione unica `agente-progetto-tony` su **PAUSED**, confermata
anche dal file di configurazione. Nessun'altra lettura WhatsApp o processo di
monitoraggio. La copertura acquisita dei messaggi rimane16nov19:22:53; la sola
anteprima uscente non attesta lettura di altri ingressi.

## Esecuzione e ownership

| Lotto               | Esecutore    | Ambito esclusivo iniziale                                                 | Stato                        |
| ------------------- | ------------ | ------------------------------------------------------------------------- | ---------------------------- |
| A1                  | implement_a1 | Backend Copilot/report, trasporto, letture deterministiche dichiarate     | Verificato localmente        |
| A2                  | implement_a2 | Progetto/create/rename/API/Admin; sezioni repository concordate           | Verificato localmente        |
| A3 e Schedule A5    | implement_a3 | Gantt, asse, colonne, reducer e comandi di vista                          | Verificato localmente        |
| A4–A8, integrazione | root         | Dashboard/preferenze, popup assistente, Tasks, comandi/voce, criticità P6 | Integrato; A7 device residuo |

Un solo writer per file; nessun subagente esegue commit/push. Root verifica e
committa i lotti. Checkout iniziale `edfe356`, un commit locale sopra origin/main;
fetch già riuscito, nessun pull necessario su checkout con modifiche. Cambi
preesistenti e `next-env.d.ts` preservati. Originali e prove private sotto
`output/tony/implementation-20261116/`, fuoriGit. Quota iniziale conto46%, uso
ordinario consentito; cap90%, stop nuovi lotti85%, riserva di chiusura5 punti.

## Prove e consegna

A1: i due testi osservati usano report/ricerca sui dati salvati con provenienza
esplicita, zero chiamate provider e stesso insieme/link dei report completi.
Domande ambigue o composte rimangono al provider configurato. Cancellazione e
metering terminale preservati, errori ACL/conflitto conservati, controllo finale
sessione/versione/moduli. Timeout20s invariato, nessun retry pagato automatico.

Profilo offline dichiarato:12prove prima/dopo su16.969righe P6 e1.354asset
sintetici, senza DB/rete/provider. Lookahead CPU p50/p95 da265/365ms a138/195ms;
search dopo4,5/13,9ms; cold parse/index≈418ms. Non prova la causa storica né
una latenza produzione.55test mirati più23dopo i guard finali PASS;1test API
isolato con61righe oltre pagina50 PASS (totali, filtri, unknown/zero, ACL,
revoca, scoping, nessuna proposta). Typecheck e lint mirati PASS.

La matrice sotto descrive l’albero integrato e i limiti di accettazione. Nessuna
pubblicazione o prova del provider live è stata eseguita.

A2 backend: creazione atomica con membership e request ID stabile, rinomina del
solo nome FieldTrack con CAS e audit; fonte P6, task, asset e versione commissioning
preservati. Il retry già consumato restituisce il profilo corrente, anche dopo
A→B→A, senza annullare rinomine successive o aggiungere audit duplicato.3test
PostgreSQL/dominio e1API demo PASS, inclusi revoca, conflitti e fixture XER
sintetica nel nuovo target. La UI Admin e la destinazione esplicita sono state verificate centralmente; nessun import reale.

A3/A8: apertura/reset su Today nel calendario del progetto, input/righello/pan
concordanti; controlli durata stabili, date opzionali, scale DAY/WK/MTH e finestre
2/4/6WK indipendenti dai filtri dei report. Comandi display tipizzati con scope,
versione e ACK della vista montata. Percentuali passi F01 separate dalla criticità.
Criticità: solo criterio P6 salvato CT_TotFloat e relativa soglia in ore; sul file
già custodito639critical/4.703non-critical/11.627unknown. Fonte immutata; modifiche
working a date/link dichiarano stale, senza CPM o ricalcolo nascosto.

QA centrale ha scoperto e corretto un parametro `critical` omesso nell'endpoint
`schedule-working`: regressione prima61anziché1, poi API working/source con filtri,
paging e invalid400 PASS e UI sullo stesso target locale1–1di1. Criterio/copertura/
stale sono visibili in Info. Durata Days→Hidden conserva x/y del controllo e data;
hide date/reset e cambio scala/finestra verificati nella UI locale. Test dominio
mirati e API A8 PASS. La suite generale dell'albero integrato ha334test PASS,
lint e typecheck PASS prima degli ultimi fix, seguiti dai relativi test mirati.
Nessun confronto di latenza o altezza in produzione dichiarato.

## Integrazione UI e matrice di copertura

| Requisiti del piano | Codice / comportamento                                                                                                                                                  | Prova locale e limite                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N01–N04, N08        | `ContextualAssistant`, `AssistantEntry`, `CopilotWorkspace`: popup nella pagina, cronologia raccolta, un suggerimento e bozza privata per utente/progetto               | Tastiera apre senza cambiare URL; bozza recuperata dopo chiusura; popup390px senza overflow e Send visibile. Il gesto microfono avvia solo il percorso scelto/consentito dal browser, mai al login. Nessun microfono reale aperto dall’agente.            |
| N05                 | `live-dictation`, `CopilotVoiceInput`: dettatura locale vera con interim separati e finale unico, soltanto se il browser dichiara `available` con `processLocally=true` | Helper di produzione provato con riconoscitore sintetico. Query nativa senza cattura sul browser/origine di collaudo: `downloadable`. Nessuna installazione, fallback cloud o prova acustica. Successo sul dispositivo di Tony ancora da collaudare.      |
| N06–N07             | Modalità comando distinta, frasi finali esatte Send question / Edit question; controllo sincrono della bozza rivista, sostituzione vocale o modifica tastiera           | Parser e guard su bozza cambiata/vuota, duplicati e callback finali verificati. I parziali non inviano né entrano nella cronologia; Send non conferma proposteF03. Riconoscimento delle frasi su dispositivo reale non provato.                           |
| N09–N12             | A1, letture salvate esplicite e provider soltanto per richieste non riconosciute con certezza                                                                           | Due testi osservati, popolazioni complete, zero/unknown/errore, ACL/versioni e cancellazione. Il no-match API usa un nome di equipment; richieste semantiche come overdue restano al provider. Nessun benchmark cloud o chiamata pagata.                  |
| N13–N15, N27, N30   | Dashboard e Reports riuniti; preview Next14days dallo stesso report, contatori separati P6/managed/task, default Admin e preferenze personali; setup in Admin           | API configura solo admin/versione corrente, preserva dati e audit. Redirect HTTP/streaming conserva filtri; URL storico verificato nella UI. Riordino cambia anche l’ordine DOM/tastiera. Report an issue resta reperibile nel menu, senza coprire campi. |
| N16–N17, N32, R01   | `ManagementBoard` reale, sette colonne selezionabili e F01; `TaskQuickDetail` conserva lista e azioni                                                                   | Sei/sette colonne, selezione mantenuta dopo Sheet, focus al trigger; righe desktop76–77px dopo azione assegnazione affiancata44px. Cards mobile, date planned/actual/baseline distinte e dati mancanti espliciti. `TaskBoard` rimasto senza diff.         |
| N18–N23, N26, N33   | A3, toolbar mobile a due righe e target44px, default durata condiviso/override personale                                                                                | Sullo stesso viewport390×844 la sezione Gantt passa da y565 a y357 e la prima riga è a y528. Nessun overflow della pagina. Durata Days/Hidden mantiene posizione; date opzionali/reset e scale/finestre indipendenti provati.                             |
| N24–N25, N31        | Comandi display sullo stesso reducer e ACK del P6 working Gantt; criticità salvata A8                                                                                   | Show months eseguito da popup desktop/mobile con righello MTH e risposta senza AI. Scope/hash/versione, loading/original e assenza della vista sono controllati; fuori Schedule viene offerto un link, senza fingere applicazione.                        |
| N28–N29             | A2, Admin→progetto separato→destinazione import esplicita, rinomina soltanto nome app                                                                                   | Fixture XER sintetica e retry concorrenti/ABA verificati. UUID, membership, task, asset, fonte e versioni preservati; nessun nuovo parser/import reale.                                                                                                   |
| R02–R05             | Riferimenti conservati nel piano                                                                                                                                        | Nessun clone delle tredici colonne, nuovo parser, PPC/Actual-vs-Planned, BIM, SharePoint o nuova tassonomia impliciti. F01/F03/F04 restano autorevoli.                                                                                                    |

### A7: stato concreto e successivo collaudo

Il nuovo percorso locale non invia audio al provider: interims e finali sono
assemblati per indice, limitati e protetti da generazione; Stop attende il finale,
Cancel/hidden/close/cambio contesto scartano il parziale. Limiti: verifica readiness3s,
attesa avvio10s, registrazione30s, finalizzazione3s e4.000caratteri. Nessun riavvio
automatico. Il WAV dopo Stop resta un’alternativa esplicita, solo con trascrizione
server già configurata, conservando controlli e metering esistenti. Lo streaming
di risposte AI non è stato aggiunto; l’animazione delle risposte complete resta tale.

Prova browser effettiva16nov20:15:36Z, **profilo in-app e origine locale3126**:
API locali presenti, verifica inglese UK `downloadable`; zero start/getUserMedia/
install/provider. Non è una prova del profilo Chrome/Brave o del dispositivo di
Marco/Tony, né della qualità vocale. Il [contratto Web Speech](https://webaudio.github.io/web-speech-api/#speechreco-section)
separa disponibilità, installazione e acquisizione; lo stato può dipendere
dall’origine. Info offre una verifica readiness senza avviare il microfono.

Residuo preciso: sul browser/origine effettivi di Tony verificare readiness; se
`available`, un collaudo microfono separatamente autorizzato deve coprire parziali,
Stop/finale, Cancel e le due frasi comando con bozza invariata. Se `downloadable`,
nessun download automatico: per abilitarlo occorre autorizzazione specifica per il
pacchetto linguistico del browser, oppure usare tastiera/alternativa dopo Stop.
Non serve chiedere un’altra chiave API. Il trasporto realtime cloud resta una
possibilità studiata con protocollo/auth/metering/cancellazione nel rapporto
privato, **non selezionata o attivata**. Il ramo live locale è implementato e provato
con eventi controllati; **A7 non è accettato integralmente su dispositivo reale**.

## Verifica finale dell’albero integrato

343 test unitari/PostgreSQL locali e21 test API PASS, zero fallimenti. La suite API
finale è stata eseguita una sola volta dopo riavvio della demo sintetica isolata:
il precedente secondo avvio della suite sulla stessa RAM aveva correttamente
rifiutato di sostituire la revisione preesistente. Il test non è stato indebolito.
Lint, typecheck e build ottimizzata globali PASS; Prettier su tutti i file src/tests modificati PASS. La build ha riscritto `next-env.d.ts`: ripristinati esattamente i byte preesistenti, verificati via SHA256. Server demo fermato e tab di collaudo chiuse.
Il controllo di formato globale segnala documenti storici/preesistenti: questi
non sono stati riformattati per mascherare il debito o inglobare modifiche altrui.

Verifica nativa desktop/mobile: popup senza navigazione, bozza e cronologia
salvata riaperte; Show months cambia il vero righello; priorità nascosta porta
Tasks da sette a sei colonne, selezione e focus restano. Nel Gantt il pan nativo
porta scrollLeft a998 e la data16→27nov; Today riporta data16nov e scrollLeft0.
Le due schermate finali sono persistenti, ispezionate e solo demo sintetica:
`output/tony/implementation-20261116/verification/dashboard-desktop.jpg` e
`output/tony/implementation-20261116/verification/gantt-mobile.jpg`.
Hash e metriche sono in `verification/ui-evidence.private.json`, fuoriGit.

Commit progressivi locali: `3e890e6` A1, `8b3d484` A2 e `34a29ff` A3/A8.
L’integrazione finale Dashboard/Tasks/popup/voce locale e i ritocchi responsive
sono consegnati con il successivo commit locale. Nessun push, deploy, scrittura
DB remota, import reale, chiamata a pagamento o nuova lettura WhatsApp.
A7 richiede il collaudo fisico circoscritto descritto sopra; il CPM completo
rimane condizionale. Non dichiarare questi due punti già collaudati.
