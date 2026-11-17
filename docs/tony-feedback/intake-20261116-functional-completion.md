# Completamento funzionale delle richieste Tony — 16–17 novembre 2026

**Esito corrente:** codice pubblicato su main `9b16754`, Vercel Production READY
e alias verificati; PDF inglese finale18pagine/21dettagli controllato18/18.
Scarti implementativi individuati chiusi, prove locali e accettazione umana
Send/Edit distinte dal collaudo AI live. Quest'ultimo **non eseguito**, in attesa
dell'unica approvazione specifica già aperta in regia dopo il rifiuto automatico.
Nessuna nuova domanda duplicata, chiamata alternativa o modifica dati business.

## Mandato e stato

Mandato umano diretto verificato nella regia: messaggio
`01a1e66b-a270-7c90-b3b0-6ba7546176cb`. Marco chiede di completare ciò che manca,
delegare in parallelo, verificare ogni richiesta, poi fare push/deploy e aggiornare
il PDF finale. Job `tony-functional-completion-20261116`, richiesta
`tony-functional-completion-request-20261116`, deadline null; owner Tony unico.
I precedenti job di implementazione e guida visiva rimangono conclusi.

Il mandato supera il precedente limite di rilascio ai sei commit fino ad a7b486a
per il risultato di questo incarico. Non autorizza nuovi servizi, segreti, modelli,
ruoli, automazioni, import o modifiche dei dati remoti. Il monitor WhatsApp resta
PAUSED: si riusano esclusivamente fonti già custodite. Nessun invio a Tony.

Stato iniziale: remoto a7b486a, checkout main 495678c (sola documentazione locale,
uno avanti/zero indietro dopo fetch). Modifiche preesistenti nei documenti e
next-env.d.ts conservate. Quota conto 50%, uso ordinario consentito; cap90/stop85.

## Scarti funzionali da chiudere

- N01–N07: primo uso voce comprensibile, avvio dal comando superiore, dettatura
  live quando supportata, correzione e Send/Edit senza registrazioni di comando
  separate obbligatorie. Le parole dentro una domanda non inviano nulla; l'invio
  della domanda non conferma una mutazione.
- N23/N24/N31: scala calendario iniziale DAY/WK/MTH distinta dalla durata,
  frasi esatte di Tony per mesi/progresso/lookahead, applicazione alla vista
  corrente con esito coerente e separazione dal report sui dati.
- N09–N12: riduzione del lavoro ripetuto e dei giri strumento non necessari,
  risposta/errore terminale e contesto corretto anche fuori dai due fast path
  consegnati. Nessuna promessa di latenza di produzione senza misura.

N01–N33 e le richieste precedenti vanno valutate su comportamento e prove,
non sulla sola presenza di documentazione o sul totale dei test verdi. KPI
esistenti e criticità P6 salvata restano i contratti approvati; CPM completo e
funzioni visibili soltanto nei riferimenti non diventano nuovi requisiti impliciti.

## Ownership e verifica

Tre figli reali con file assegnati: `implement_a1` voce/onboarding/composer;
`implement_a3` parser/comandi e preferenze Gantt; `implement_a2` server, tool e
prestazioni. Integrazione, test finali, QA desktop/mobile, commit/push/deploy e
PDF al solo owner centrale. Revisore indipendente della regia in sola lettura.

Prove private e ricevuta del mandato: `output/tony/functional-completion-20261116/`.
Originali, testi privati, screenshot e PDF fuori Git. La guida stabile resta
`output/pdf/fieldtrack-visual-update-20261116-en.pdf`; riusare le immagini valide,
aggiornare quelle cambiate e ispezionare tutte le pagine finali.

Implementazione e verifiche in corso. Nessun nuovo rilascio o collaudo reale
attestato da questo stato iniziale.

## Steering e prova umana successivi

Marco ha confermato **«Send ed edit funzionano»** nella prova richiesta in Chrome
sulla demo sintetica locale3126: user `01a1e685-9186-7140-a3ff-a8092cf2ff2f`, reply
alla domanda `call_689ca4c214594e11938064643054f6d1`. È accettazione umana locale
di quel percorso, distinta da test sintetici, qualità acustica generale e produzione.
Nessuna cattura o installazione è stata eseguita dall'agente.

Nuovo steering diretto `01a1e686-3350-74d3-99b7-659d1a0965ad`: chat familiare come
il riferimento Codex fornito da Marco, con conversazione protagonista e un unico
composer ancorato in basso, testo/microfono/invio e stati Stop chiari. Palette e
brand FieldTrack, storia privata e conferme mutazioni restano invariati; niente
controlli finti, nuovi modelli/allegati o voce bidirezionale impliciti. Il ramo UI
è riassegnato al medesimo owner voce, senza writer concorrenti.

La review indipendente ha trovato un P2: un vecchio intento voce poteva riapparire
nel ciclo progetto A→B→A. Va consumato al cambio contesto con regressione di
lifecycle; il corretto teardown della precedente cattura non basta. Nel lotto QA
Gantt sono emersi etichetta mese non visibile in una finestra parziale e valore
durata mobile troncato: correzione circoscritta e unica conferma visiva prevista.

## Matrice di accettazione finale — contratto verificabile

Le righe distinguono implementazione e prova locale dalla verifica online.
I riferimenti N rimandano alla matrice delle fonti già custodite nel piano16nov;
le richieste precedenti sono riconciliate dal revisore indipendente. Le prove
private del job conservano log, scenari, schermate e hash, non il solo conteggio test.

| Richiesta | Risultato funzionale e prova                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| N01       | Percorso primo uso con setup; successivo intento esplicito dal comando superiore. Controller/gesture fence e UI verificati; parlato Send/Edit confermato da Marco in Chrome demo.                                  |
| N02       | Controllo dispositivo senza ascolto; download solo da pulsante umano, permesso browser distinto. Setup visibile desktop/mobile; nessuna cattura al login o dal parametro URL.                                      |
| N03       | Popup nella pagina Schedule, senza navigazione automatica; comandi sulla vista montata e progetto corrente. QA source e managed; selezione progetto isolata.                                                       |
| N04       | Ingressi tastiera/voce sullo stesso popup, chiusura e ritorno focus. A→B→A non riapre il vecchio intento (helper di produzione e verifica browser tastiera).                                                       |
| N05       | Interim/finali nativi mostrati come preview, finale dopo Stop e cancellazione distinti. Test controller più prova umana locale; non è garanzia di accuratezza su ogni browser/ambiente acustico.                   |
| N06       | Send come utterance autonoma dopo revisione/pausa, nella stessa cattura; Stop atteso, invio singolo. Test negativi e conferma umana locale; nessuna conferma mutazioni implicita.                                  |
| N07       | Edit nella stessa cattura per sostituire la domanda; tastiera/multilinea disponibili. Test reducer, controllo bozza modificata e prova umana Send/Edit; nuovo composer unico.                                      |
| N08       | Un suggerimento discreto, conversazione centrale, cronologia/opzioni compatte. QA popup e pagina completa su desktop/mobile; storia conservata.                                                                    |
| N09       | Letture SQL mirate, memo per richiesta dopo ACL fresche, indicizzazione gruppi e riepilogo autorizzato nel primo contesto. Profilo locale con campione dichiarato; nessuno SLA cloud dedotto.                      |
| N10       | Domanda lookahead esatta dà report salvato con totale/finestra/provenienza e link coerenti. QA46/112 su fixture locale del16nov; builder/API testati.                                                              |
| N11       | Ricerca chiller su Schedule completo, distinta da asset/task. QA2/12 P6 working e link; test ricerca oltre pagina, ID/nome e contesto.                                                                             |
| N12       | Risultato/vuoto/errore terminali, storia privata e retry solo storage. Guard finali più forti su versioni task; recovery solo narrazione/trasporto, mai meter/tool/protocollo/ACL/cancel. Suite e review dedicate. |
| N13       | Dashboard mostra subito metriche FieldTrack esistenti con popolazioni separate e drilldown. Prove consegna precedente conservate; nessun nuovo KPI dedotto dalle reference.                                        |
| N14       | Reports dentro Dashboard con URL/filtri/export precedenti preservati. Prove precedenti e suite report attuale; moduli e ruoli invariati.                                                                           |
| N15       | Default condivisi Admin e preferenze personali separati. QA salvaMTH con durataDays, personaleWK/reload/reset; test legacy eredita nuova scala senza cancellare pannelli/durata.                                   |
| N16       | Tasks compatta con colonne selezionabili e dettagli laterali. Prove desktop/mobile precedenti ancora valide, nessun cambiamento della tabella in questo incremento.                                                |
| N17       | Cerchio passi richiesti applicabili e semaforo F01; approvazione/firme separate. Test dominio/report e prova precedente60%=3/5, ignoti mai convertiti in zero.                                                     |
| N18       | Gantt source dominante, metadati raccolti e toolbar compatta. QA dati visibili desktop/mobile; screenshot e misure precedenti conservate.                                                                          |
| N19       | Date opzionali indipendenti; nascoste nella QA mobile senza cambiare date salvate o righe.                                                                                                                         |
| N20       | Durata Days/Hours/Hidden distinta dalla scala; posizione stabile dopo hide. Conferma mobileHidden leggibile,80×44px.                                                                                               |
| N21       | Calendario compatto e modo leggibile; etichetta del periodo centrata nell'intersezione visibile anche parziale/pan. Test asse e conferma desktop/mobile.                                                           |
| N22       | DAY/WK/MTH e2/4/6WK, geometria/finestra separate da filtri report. Test dominio e QA MTH+2WK reale.                                                                                                                |
| N23       | calendarScale condivisa persistita come day/week/month, defaultday; durationMode resta separata. API/PGlite e QA Admin/reset/personale, senza migrazione DB.                                                       |
| N24       | Frasi esatte mesi e2week cambiano la vista corrente con ACK. Test parser/guard e QA source/managed; richieste esplicite report mantengono il percorso report.                                                      |
| N25       | Show critical path usa criterio P6 salvato con soglia/provenienza, missing e stale working espliciti. QA3critici fixture; nessun motore CPM working aggiunto (fuori perimetro condizionale approvato).             |
| N26       | Apertura/reset su Today nel timezone di progetto, data/asse coerenti. QA16→17nov e pan/reset; date attività non spostate per renderizzare barre.                                                                   |
| N27       | Complete project setup in Admin, con link ai moduli esistenti. QA e prove precedenti, senza nuovi diritti.                                                                                                         |
| N28       | Nuovo progetto distinto e destinazione XER esplicita, preview e retry idempotente. Test creazione/import demo; nessun import cliente reale in questo job.                                                          |
| N29       | Nome FieldTrack distinto da nome/file P6, identità/versioni/referenze preservate e retry ABA protetto. Test dominio/API precedenti e suite corrente.                                                               |
| N30       | Report feedback, report Dashboard e report assistente restano ingressi distinti e reperibili. QA navigazione/etichette, moduloReports e ACL conservati.                                                            |
| N31       | Show task progress e catalogo colonne applicano lo stesso reducer/UI. QA headerSteps%0→1 su source e managed; unsupported specifici, nessun falso successo.                                                        |
| N32       | Sei/sette colonne logiche iniziali e catalogo finito di comandi, ampliabili tramite i controlli. Non viene copiato l'intero prodotto di riferimento.                                                               |
| N33       | Menu/opzioni raccolti, dati e conversazione al centro. Nuovo steering Marco verificato nel popup e nella pagina completa, con composer singolo e target44px.                                                       |

Le richieste precedenti su tagging/WTG/supplier esplicito, filtri cumulativi,
progressi F01, proposte F03 con CAS/anteprima/conferma, working Schedule, nuova
attività asset, libreria/lessons, import canonici e chat/usage mantengono i contratti
consegnati. Il revisore non ha stabilito ulteriori scarti funzionali certi.
Mapping, supplier, schede, risposte e assegnazioni effettivamente presenti nei dati
reali restano fatti da leggere, non da inventare o completare automaticamente.
Nella sessione produzione letta prima del rilascio, AMS16·Test mostrava305task,
1354asset e11510attivitàP6, con305task privi di collegamenti asset/Schedule.
Questa osservazione non autorizza modifiche business né dichiara popolati i workflow.

R01–R05 restano reference con esclusioni approvate: niente nuovi parser impliciti,
SharePoint/BIM/PPC/ConstraintLog/SetBaseline, CPM completo o streaming delle risposte
AI dedotto dalla richiesta di vedere il testo dettato. La produzione sarà attestata
separatamente con SHA/deploy/alias e sole verifiche effettivamente eseguite.

## Verifica integrata del risultato — 17 novembre 2026

Codice finale locale `16a9687016379ecb388c748c5762399e4c0d9cba`:

- **372/372 test unitari/PGlite PASS**, inclusa la classificazione `AbortError`
  come cancellazione terminale e non errore trasporto recuperabile. Il precedente
  test di metering è rimasto invariato;35test mirati coprono l'ultimo delta.
- **21/21 API PASS**, una sola esecuzione nella copia privata isolata su3137,
  con snapshot backend fddcd58; le route/guard API non cambiano nell'ultimo delta
  di classificazione, coperto dai test mirati e dalla suite372 finale. Server
  del test fermato e porta chiusa; nessun uso della sessione3126 per la suite.
- Lint, typecheck, build e formato dei38file sorgenti/test cambiati PASS.
  Detector Impeccable finale: nessun finding sui10componenti UI cambiati.
- QA desktop e390×844: source/managed ACK, colonne progresso0→1, mesi/2WK,
  default Admin/personal/reset, Today, focus, un solo composer, Enter e input
  multilinea, controllo opzioni/setup, footer sopra la navigazione. Due rilievi
  indipendenti (intent lifecycle e origine recovery) chiusi; conferma mirata dei
  fix visuali conclusa, nessun ciclo estetico aperto.
- `next-env.d.ts` ripristinato agli esatti byte preesistenti (SHA256
  `0f70629890b72a0a82e91972cc032c04b658b26c265373cb711cf576bfbf8fcc`),
  escluso dallo staging. Entrambe le demo sono ferme.

Il profilo CPU locale (4warm-up+12campioni) misura contesto p50
20,01→1,76ms e tre risoluzioni working133,83→50,92ms, con checksum contesto
identico. Il builder report invariato ha misurato112,39→141,16ms: **nessun
miglioramento rivendicato su quel builder**. Il conteggio SQL deriva dal codice,
non da un trace cloud: per un turno con un tool base e due salvataggi storia,
62→17statement (escluse operazioni meter/source/proposte dichiarate nel profilo).
Nessuno SLA di produzione o diagnosi storica dei timeout è dedotto da questi dati.

Preflight rilascio: fetch completato, main avanti7/indietro0 rispetto alla
precedente release a7b486a, nessun pull/reset/stash. Repository
MacroBet/time-tracker-tony e target `macrobets-projects/time-tracker-tony`
(`prj_hqtnQUnlqpG0tpjFM49p0Q73m9Vz`) verificati. In Production nessun gate
migrazione0006/0007 è presente; la presenza della chiave esistente è stata
controllata solo come booleano, senza stampa o salvataggio valori. Il push/deploy
è già autorizzato dal mandato diretto corrente; esito effettivo ancora da attestare.

La guida precedente a7b486a è conservata privatamente e verificata prima
dell'aggiornamento:2.069.657byte, SHA256
`3cb116cfc3919b08d65f00f8b801711e06e9ce7ace231df4527799d42b78f936`.
La nuova guida18pagine riusa le immagini valide e aggiorna default, chat/voce e
mobile; generazione vincolata a ricevuta Production READY del nuovo SHA.

## Pubblicazione verificata — 17 novembre 2026

Push normale di8commit da a7b486a a
`9b16754267bd610fb8ad82002b9bb14ad6d1a53d` su origin/main,
MacroBet/time-tracker-tony. Ultimo commit di codice `16a9687`; nessun force,
reset, stash o pull sopra modifiche. L'integrazione Git esistente ha prodotto
un solo deployment, senza un secondo deploy CLI:

- Vercel `dpl_5qPypUqfkehsv4rxgwRpBygPiMXk`, target production,
  stato **READY**, URL
  `https://time-tracker-tony-oz2x12jav-macrobets-projects.vercel.app`.
- Metadata del deployment legati allo SHA9b16754; GitHub Vercel status success e
  deployment Production `7839546938` success sul medesimo SHA.
- READY16nov23:39:55,538UTC, cioè **17nov00:39:55,538Europe/Rome**;
  stato GitHub success16nov23:39:56UTC. Non confondere data UTC e locale.
- Alias `https://time-tracker-tony.vercel.app` risolto allo stesso deployment,
  HTTP200. Sessione anonima currentUser=null; API admin/ai-usage401.
- Chrome autenticato da Marco: Dashboard, Schedule, default Admin e contesto
  chat letti sul nuovo rilascio. Schedule11.510attività, prima pagina50;
  calendarScaleDAY e durataDays distinti. Nessun form salvato o proposta inviata.
- Controllo voce della pagina online: **ready for live English (UK)**. Nessun
  avvio microfono, permesso o installazione da agente. Questa verifica tecnica
  online non amplia la prova umana locale Send/Edit a ogni dispositivo/acustica.

Ricevuta privata `output/tony/functional-completion-20261116/release-final.private.json`,
con hash dei riscontri Vercel/GitHub/alias/letture. Le schermate del PDF restano
sintetiche locali, separate da queste verifiche autenticate.

## Singolo test AI live: limite concreto ancora aperto

Il controllo automatico ha respinto l'azione **prima dell'esecuzione** perché
avrebbe trasmesso contesto del progetto a OpenAI e potuto generare consumo API;
il mandato generale di collaudo non era un'autorizzazione sufficientemente
esplicita su quel payload e costo. **Nessuna domanda inviata, zero chiamate
provider e nessun tentativo alternativo.** Non si dichiara quindi verificata una
risposta generata live o una latenza cloud.

In regia è già aperta una sola richiesta specifica per AMS16·Test, configurazione
OpenAI esistente, normale consumo API, timeout20s, massimo4richieste provider,
nessun retry né modifica dei dati business. Testo concreto:

> Using only the saved project counts already supplied, state the total assets,
> saved tasks and imported P6 activities in one short sentence. Do not change any records.

Un eventuale invio autorizzato registrerebbe normalmente conversazione e meter;
queste scritture vanno distinte da asset/task/Schedule. L'approvazione rimane
pendente, non è dedotta dal tempo trascorso. Chiave, modello e servizio non
sono stati creati, sostituiti o esposti. Publisher della regia proprietario di
richieste/eventi; nessun callback interchat o impersonazione da questo owner.

## PDF finale e chiusura del lavoro indipendente

Finale privato stabile `output/pdf/fieldtrack-visual-update-20261116-en.pdf`:
**18pagine,21schermate/dettagli,2.306.777byte**, SHA256
`3ed240e9512cd60a00801f94577806a2d56bac548d0ca9945c3d0c96c83c1053`.
Aggiornate preferenze/scala Admin, comandi esatti, composer popup/completo,
setup voce e mobile; immagini ancora valide riusate. PDF precedente conservato.

ReportLab generazione solo dopo ricevuta READY,18render Poppler ispezionati:
pagine1–9 dal revisoreA3,10–18 dal root, tutti PASS. Testi/titoli/footer/numeri,
confini e21hash screenshot verificati; prosa ASCII, link pubblico funzionante.
Manifest pagina→richiesta→originale/hash/ritaglio e ricevute QA sotto
`output/tony/functional-completion-20261116/visual-guide/`, esclusi daGit.
Il primo render ha emesso avvisi fontconfig sulla cache non scrivibile ma è
terminato con18PNG completi; testo renderizzato controllato senza difetti.

Entrambe le demo sono ferme, viewport temporanea ripristinata e tab locale
creata per la prova voce chiusa. Sessione Chrome produzione mantenuta come
risultato disponibile. Nessuna suite app ripetuta per la sola documentazione,
nessun ulteriore deploy per metadati di chiusura. next-env e cambi preesistenti
preservati; chiusura documentale locale distinta dal codice già online.

Quota condivisa conto50→53%, uso ordinario consentito, cap90/stopnuovi85;
variazione non attribuita al solo job. Monitor **PAUSED**, nessun WhatsApp,
invioTony, import, scrittura business remota o scheduler aggiuntivo.
Prossimo passo residuo: sola decisione sulla prova AI concreta già in regia;
non attendere né ripetere polling automatico a stato invariato.
