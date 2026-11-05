# Ripresa Tony — 5 novembre 2026

## Mandato e copertura attestata

Marco ha chiesto nella regia di riprendere il lavoro perché Tony ha scritto nuovi
messaggi. Fonte nativa verificata via `read_thread`: chat
`01a1493a-ee0b-7d62-a861-d8d546bf013c`, messaggio umano
`01a1aaa9-a311-7b30-a6b2-788755692e67`. Il mandato corrente autorizza lettura,
confronto e modifiche locali chiare e reversibili, test e commit locali mirati.
Non autorizza push, pubblicazione, spese, nuovi accessi o messaggi al cliente.
Riusata la correlazione `tony-new-whatsapp-feedback-20261017`; nessun nuovo job,
scheduler, callback o modifica alle richieste della regia.

WhatsApp Mac già autenticato, chat individuale selezionata **Tony McIntyre** e
intestazione coerente. Non attestato un identificatore univoco del contatto.
Ultima lettura incoming precedente: **19 ottobre, 20:53**; invio successivo
**20 ottobre, 11:43** verificato separatamente. Il nuovo controllo si sovrappone
visivamente a quell’outgoing e legge **14 nuovi testi incoming** fino al
**5 novembre, 08:11 Europe/Rome**. Nessun nuovo allegato o audio nell’intervallo
osservato. Nessuna bolla successiva visibile a quel controllo.

| Data UI                 | Testi incoming nuovi letti | Metodo                                    |
| ----------------------- | -------------------------: | ----------------------------------------- |
| 20 ottobre, 12:27–16:14 |                          4 | AX e screenshot                           |
| 29 ottobre, 04:31–04:34 |                          3 | AX e screenshot; uno con etichetta Edited |
| 3 novembre, 14:04–14:08 |                          6 | AX e screenshot; due distinti alle14:08   |
| 5 novembre, 08:11       |                          1 | AX e screenshot del fondo                 |

L’AX ometteva diversi testi: letti con due screenshot sovrapposti della chat,
non dedotti dall’anteprima. Nessun contenuto di altre conversazioni salvato o usato.
Il messaggio outgoing28ott08:56 è contesto dell’account, non un invio attribuito a
questo esecutore. I heartbeat dal22ott non avevano esteso la copertura: nessuna
lettura retroattiva implicita. Restano i gap storici anteriori.

Testi e metadata privati, con trascrizione manuale e punteggiatura normalizzata:
`output/tony/read-resume-20261105.private.json`, SHA256
`d9a358979e479ece208ed111847d4744211b1529f46cf4b61b3ac8d904b88be1`.
Nessun nuovo originale scaricato: i29 originali WhatsApp e i7 mail restano distinti.
Composer non digitato, nessuna nuova bozza incollata o invio. Le vecchie approvazioni
17/20ott sono consumate e non riutilizzate.

## Richieste esplicite e confronto con il codice

Queste sono parafrasi analitiche, non trascrizioni private.

| Richiesta esplicita                                                                                    | Riscontro attuale                                                                                                                                                         | Esito/priorità                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pianificazione in stile MS Project; date da P6 oppure manuali                                          | Gantt persistente, date/durate, FS con lag, preview/revisioni/baseline già esistenti. L’import fedele di calendari/relazioni P6 rimane incompleto, come nell’analisi20ott | **P1** contratto import e logica da definire; nessuna equivalenza completa MS Project dichiarata                                                          |
| Tasto destro sulla riga Gantt per modificare senza modulo principale                                   | Prima il click apriva l’editor sopra il Gantt                                                                                                                             | **Lotto locale concluso:** pannello rapido sulla riga/barra, matita e Shift+F10                                                                           |
| Logica comune ai progetti quando si carica una lista asset, con ID/tag e regole regolabili dall’utente | Import CSV/JSON con ID espliciti, collegamenti verificati e preview dei tag; nessuna inferenza generale della sequenza                                                    | **P1** manca il contratto asset→tag→attività/dipendenze. La risposta conferma conservare la logica, non definisce tutte le regole di ricalcolo/calendario |
| Dashboard migliore e più semplice                                                                      | Overview per ruolo, contatori/drilldown e riepiloghi già presenti                                                                                                         | **P2** richiesta ampia; Project Health e nuova gerarchia visiva non specificati. Nessun redesign arbitrario                                               |
| Tabelle Excel e pulsante per estrarre un template                                                      | Runtime accetta CSV/JSON; XLSX esplicitamente rifiutato. Prima il template asset era disponibile solo a registro vuoto                                                    | **Lotto locale concluso:** template CSV vuoto sempre scaricabile; **residuo:** chiarire asset/programma/checklist/allegati e supporto XLSX                |
| Admin assegna esecutori e approvatori                                                                  | Esecutori già assegnabili a worker membri del progetto da admin/manager/supervisor; review distinta dal risultato                                                         | **P1** approvatore assegnato distinto e firme provvisorie/finali non consegnati; revisione checklist/gate ancora da confermare                            |
| Foto legate ad asset/location; server per ora, possibile host esterno; video suggerito30secondi        | Allegati legati alla task e indirettamente ad asset/tag/location. PNG/JPEG/WebP/PDF,2MB/file,20file/task, base64 nel DB                                                   | **P2** video non supportato; servono byte massimi, durata verificabile, accesso e conservazione. Nessun provider/storage attivato                         |
| Invio futuro di strutture checklist per tutti i tag                                                    | Nessuna nuova struttura allegata in questo intervallo                                                                                                                     | Attesa materiale; non considerata una checklist approvata                                                                                                 |
| Quando fare il prossimo aggiornamento                                                                  | Chiede una previsione, non approva un testo o una pubblicazione                                                                                                           | Risultato locale pronto per revisione Marco; nessuna data promessa al cliente                                                                             |

Riferimenti audit: `src/lib/asset-transfer.ts`, `src/lib/commissioning-import.ts`,
`src/server/operations.ts`, `src/server/handlers.ts`, `src/server/db/schema.ts`,
`src/app/components/TaskDetail.tsx`. L’audit statico non è prova di collaudo in produzione.

## Lotto applicativo locale

`ScheduleWorkspace.tsx`: right-click sulla riga o sulla barra apre un popover
ancorato all’attività, con data minima, durata, progresso e dipendenze espandibili.
La matita offre lo stesso ingresso senza tasto destro; Shift+F10 ed Escape hanno
ripristino del focus. Il click normale e la vista mobile Activities restano disponibili.
Il pannello riusa `ActivityEditor` e le API originali: nota obbligatoria, anteprima,
conferma, controllo versione, blocco offline, actual finish e baseline preservati.
Nessun nuovo schema, motore di scheduling, permesso o endpoint.

`CommissioningWorkspace.tsx`: download del template vuoto separato dall’export
asset. Contiene BOM UTF-8 e soltanto le19 intestazioni canoniche; non copia i dati
del progetto e non chiama API. La copia indica Excel→salvataggio CSV prima dell’import.
Non è supporto XLSX o import automatico della logica.

Un subagente reale con ownership esclusiva del file Commissioning ha implementato
il template e svolto l’audit indipendente; root ha integrato e verificato.
La revisione statica finale ha rilevato un fallback timeline non focalizzabile:
corretto con `tabIndex={-1}`. Nessun rilievo residuo segnalato.

## Prove e limiti

- **115/115 test unitari/PostgreSQL** passati; **10/10 API** passati.
- Typecheck, lint, build Next e formato dei file modificati passati.
- Detector Impeccable sui due file UI: nessun rilievo.
- Browser nativo in tab temporaneo nascosto, demo locale isolata1440×1000 e390×844:
  right-click riga/barra, matita, tastiera, annullamento e ripristino focus;
  conflitto con successore completato respinto senza pulsante salvataggio;
  modifica valida progresso90→91 salvata con chiusura pannello, stessa pagina
  e dato presente dopo reload. Baseline originale ancora mostrata.
- Template scaricato dal registro popolato: BOM e19 header, zero righe dati.
  Mobile senza overflow orizzontale del documento; nessun errore console osservato.
  Il pannello scorre internamente per dipendenze/anteprima su schermi piccoli.
- Screenshot sintetici privati in `output/playwright/nov5/`: desktop-quick-edit.png,
  mobile-quick-edit.png, mobile-template.png. Tab chiuso e viewport ripristinato;
  server demo terminato.

API/browser soltanto con `DATABASE_URL=''`, `DATABASE_URL_UNPOOLED=''`,
`DEMO_MODE=true`, `COPILOT_ENABLED=false`, `OPENAI_API_KEY=''`, `OPENAI_MODEL=''`.
Build finale nelle stesse condizioni. Nessun DB remoto, import cliente o AI live.
Una prima build è stata interrotta prima della chiusura; solo la build isolata
successiva è considerata prova finale. Nessun deploy dedotto dalla build.

Quota conto rilevata con tool nativo5nov:51% all’avvio,52% alla chiusura dei test,
uso ordinario consentito. Valori attuali del controllo, non campioni storici;
nessun reset/acquisto/credito aggiuntivo utilizzato, token del job non misurati.

Git: fetch riuscito5nov senza modifiche a chiavi/accessi. HEAD iniziale8d9e95c,
10commit avanti alla ref origin/main aggiornata; nessun pull su checkout modificato.
Preservati tutti gli edit preesistenti, compreso next-env.d.ts; nessun reset/stash/force.
Commit locale mirato **aa84ee4** (codice, intake e indice). **Nessun push o deploy**: il mandato
corrente li esclude. La consegna locale non risponde ancora a tutti i requisiti nuovi.

## Audit dei residui e secondo intervento locale — 5nov08:34UTC

Prosecuzione manuale dell'incarico sopra, con la successiva richiesta di Marco
di verificare se tutto il lavoro eseguibile fosse stato fatto, riferita dal
supervisore. Non è un ampliamento del heartbeat. Nessuna nuova lettura WhatsApp,
mail o altre chat: riusate le14 fonti e l'analisi già salvate. L'audit distingue
lavoro tecnico residuo e decisioni mancanti; la seconda categoria non blocca
automaticamente la prima.

| Richiesta                             | Stato effettivo dopo l'audit                                                                                                                                       | Parte indipendente / prossimo lavoro                                                                                                                                                                                                                                                                                     | Domanda che blocca davvero la parte restante                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modifica rapida Gantt                 | Consegnata localmente in aa84ee4 con preview/conferma/versione/baseline                                                                                            | Nessun altro intervento chiaro necessario su questo ingresso                                                                                                                                                                                                                                                             | Nessuna per il tasto destro già richiesto                                                                                                                              |
| Date manuali, logica P6 e dipendenze  | Motore lun–ven, FS/lag nonnegativo, baseline e actual; incompatibilità P6 già documentate                                                                          | Controlli esistenti per riferimenti, cicli, date, actual e baseline verificati staticamente; riproduzione sintetica di start/finish invertiti respinta. Nessun bug schedule confermato né conversione XER improvvisata                                                                                                   | Per generare sequenze: un esempio asset→tag→attività/dipendenze e regole modificabili. Per fedeltà P6 completa: calendario e relazioni richieste sul programma pilota  |
| Tabelle Excel / template asset        | Template CSV vuoto disponibile; le19 colonne asset sono già definite, non vanno richieste di nuovo                                                                 | **Lavoro tecnico aperto:** adattatore XLSX sullo schema esistente. Package e lock non contengono lettori XLSX/ZIP/XML runtime; openpyxl è già usato soltanto dagli script di revisione. Nessuna nuova dipendenza/accesso installati in questa prosecuzione. Il preflight reviewOnly non viene fatto passare per importer | Nessuna nuova domanda sulle colonne asset. Serve chiarire il contenuto soltanto per tabelle programma/checklist ulteriori, non per bloccare il registro asset canonico |
| Import senza perdita di dati          | **Difetto riprodotto e corretto in 5f4cd7c:** JSON parziale cancellava posizione, consegna e link omessi; CSV già li conservava                                    | Lettore JSON integra solo campi opzionali dell'asset esistente prima dei default Zod; campi obbligatori, ID nuovi e validazione restano tali. Merge e modulo asset invariati                                                                                                                                             | Nessuna; non dipende da nuova sequenza o da P6                                                                                                                         |
| Dashboard più semplice                | Overview per ruolo, stato, completati/late e drilldown, tag e lista overdue già presenti                                                                           | Una revisione della gerarchia visiva può usare le metriche attuali senza attendere Project Health; resta lavoro distinto, non dichiarato consegnato da questo fix. Nessun nuovo calcolo o redesign arbitrario in questo intervento                                                                                       | Solo per un rating Health: criteri On/At/Off Track e perimetro. Non serve riproporre la domanda per i contatori già definiti                                           |
| Admin assegna esecutori e approvatori | Assegnazione esecutore già presente con worker membro del progetto, ruoli manager/supervisor/admin, motivo/versione/audit; approvatore nominativo distinto assente | Riutilizzare il flusso esecutore esistente; nuovo campo approvatore e gate non aggiunti come semplice copia di assignedTo                                                                                                                                                                                                | Chi può approvare, a quali passi/tag si applica, eventuale separazione da esecutore e quali firme provvisorie/finali sono richieste nella checklist autorevole         |
| Foto asset/location e video30s        | Foto/PDF su task già collegate all'asset/tag/location; autorizzazione download presente. Nessun archivio location indipendente; video assenti                      | Tracciabilità task→asset già presente, non richiede storage nuovo. Il contratto video resta distinto da un cambio di provider; nessun limite inventato o servizio attivato                                                                                                                                               | File-size, conservazione e accesso; se serve prova direttamente su location senza asset/task. Durata30s richiesta non definisce da sola il contratto di caricamento    |
| Strutture checklist per tutti i tag   | Materiale aggiuntivo annunciato ma non presente nei14 testi; catalogo manuale già locale                                                                           | Nessuna compilazione automatica, checklist generata o approvazione dedotta                                                                                                                                                                                                                                               | Checklist/revisione da implementare e regole passi/prove/NC/firme                                                                                                      |
| Quando il prossimo aggiornamento      | Due interventi locali pronti per revisione, non pubblicati                                                                                                         | Bozza breve preparata solo localmente, senza data promessa                                                                                                                                                                                                                                                               | Eventuale invio richiede approvazione di Marco sul testo esatto corrente                                                                                               |

### Correzione e verifica mirata

Il problema era nel confine file JSON, prima dei default schema: un import con
soltanto `id/name/equipmentType/levels` sostituiva posizione e rimuoveva i collegamenti
di consegna e per livello. Non si è estesa la whitelist di `mergeRegister`, perché
il modulo usa legittimamente omissioni per cancellare le date. Il fix riutilizza
solo l'asset dello stesso ID nella lista corrente fornita dal chiamante.

Restano obbligatori tutti i quattro campi core. Valori espliciti vuoti/null sono
ammessi solo dove già previsti dallo schema; unknown e date non valide restano
respinti. In JSON l'omissione di `deliveryActivityId/expectedDelivery` ora conserva
il valore: per cancellarli usare modulo o cella CSV esplicitamente vuota. Il
[contratto identificativi](../programme-identifiers.md) descrive questa differenza.

**29/29 test mirati** (`asset-transfer`, `commissioning`, `programme-identifiers`),
typecheck, lint dei due file TS e formato passati. Tre nuovi casi coprono perdita
riprodotta/idempotenza/sorgente invariata, clear esplicito e clear dal modulo,
validazione/ID nuovo. Revisione indipendente del subagente riusato: nessun rilievo
bloccante. Le115 prove e i10 API del primo lotto non sono stati ripetuti o contati
come nuove prove; nessuna nuova build o sessione browser necessaria per questo
adattatore di input puro. Nessun import reale o database contattato.

Fetch origin riuscito prima degli edit; main era12 commit avanti e0 indietro.
Commit locale **5f4cd7c** (lettore, test, contratto), senza push/deploy. Modifiche
preesistenti e next-env.d.ts preservati. Quota conto nativa52% all'avvio e53% al
controllo08:34UTC, uso ordinario consentito: variazione globale non attribuibile
come consumo di questo incarico; nessun reset/credito aggiuntivo usato.

Bozza inglese breve soltanto in `output/tony/next-questions-20261105.private.txt`;
stato non approvato e non inviato, nessun composer. La versione esatta e il suo
hash sono nel report metadata. La bozza distingue il risultato locale dall'XLSX
ancora da implementare e domanda soltanto sequenza, checklist/ruoli e video.

## Prossimo passo concreto

Revisionare il risultato locale e la matrice: **non tutto è completato**.
L'adattatore XLSX e la semplificazione della dashboard restano lavoro tecnico
distinto dalle decisioni su sequenze, approvatori e video; non è corretto chiamare
tutti questi punti un unico blocco di chiarimenti. La bozza può essere rivista in
Codex; nessuna approvazione precedente autorizza l'invio o una pubblicazione.
