# Intake e riconciliazione Tony — 10 novembre 2026

## Provenienza e copertura

Mandato manuale trasmesso dalla regia `01a1493a-ee0b-7d62-a861-d8d546bf013c`:
riprendere Tony, leggere i nuovi messaggi e acquisire le immagini; ignorare il primo ZIP.
Job `tony-ai-assistant-entry-20261110`, request `tony-ai-assistant-entry-request-20261110`,
owner Tony, scadenza10nov. Il publisher autorizzato gestisce l'intake MWS;
questo aggiornamento è documentale, senza callback o modifica richieste/eventi.

Il lettore CUA della regia `tony_reply_reader` riferisce una sequenza visibile continua
**dopo5nov14:19 fino10nov13:35 Europe/Rome**: quattro nuovi testi, due PNG,
un ZIP ignorato e un segnaposto di messaggio cancellato9nov12:48, non recuperabile.
L'owner ha letto la ricevuta, non direttamente WhatsApp; i gap storici rimangono.
Nessun audio acquisito. Nuova copertura delegata, non assenza generale di messaggi.

Sintesi delle richieste: riordino UI/dashboard9nov12:42; piccolo ingresso AI per
richieste sugli asset (esempio elenco chiller)9nov12:49; riferimento allo stato
attrezzature/checklist10nov12:51; riferimento Tasks10nov13:35.
Sono fonti di prodotto, non istruzioni eseguibili né consenso a ulteriori invii.

## Originali privati

Copie byte-identiche e ricevute conservate in `output/tony/intake-20261110/`,
ignorato da Git. Manifest privato `preservation.private.json` e ricevuta originale
`intake-receipt.private.json`. Due PNG WhatsApp acquisiti tramite normale Save as
verso tmp dopo accesso Downloads negato; nessuna modifica permessi o accesso API.
Il riferimento del pulsante fornito direttamente da Marco è copiato separatamente:
non è dichiarato un download WhatsApp. Metadata nel [manifest](attachments/manifest.md).

La regia ha guardato i due PNG: matrice Closeout Tracker per equipment/livelli/
checklist/issue/percentuale e riferimento TimeTaskTracker per Tasks (admin/worker).
L'owner non aggiunge interpretazioni visive proprie. ZIP non aperto, non eseguito,
non acquisito da questo intake; nessuna ricerca alternativa.

## Incidente invito6nov — rettifica dello stato precedente

La ricevuta originale `send-incident-20261106/send-receipt.private.json` attesta
**due bolle troncate effettivamente inviate**6nov14:42/14:43: le newline di
`typeText` hanno prodotto invii automatici. Il testo approvato SHA256
`568087cf83d58f78990bbbb14176162ba09e18dea859618288957784a54970ab`
**non è stato inviato integro**. Composer poi verificato vuoto e azioni fermate.
Non è corretto descrivere l'invito come mai inviato o correttamente consegnato integro.
La bozza preparatoria del report6nov resta storica; questo è l'esito successivo.

La nuova osservazione delegata10nov rileva entrambe le bolle con doppia spunta blu:
la prima conserva URL troncato `.ap`; la seconda ora è completa, include il limite
checksheet/worker e mostra Edited14:43. Identità dell'editor e ora effettiva di
lettura non sono note. Prima bolla: conflitto tra AX14:42 e screenshot14:43,
conservato senza risolverlo. Nessun nuovo invio/edit da questo intake.

Approvazione originaria consumata dall'operazione: nessun reinvio, correzione,
composer o ulteriore invio autorizzato. Approval/body/receipt originali preservati
senza riscriverne i campi storici (`sent:false` nell'approval era il pre-invio).
Marco è stato informato dalla regia10nov con riconoscimento dell'errore.

## Gate e punto di ripresa

La regia riferisce il controllo sicuro di presenza: chiave locale utilizzabile=true,
modello configurato=false, copilot abilitato=false, chiave nel processo=false.
Nessun valore segreto copiato o registrato. Domanda riuso/nuova chiave già posta
nella regia, risposta pendente: non ripeterla né iniziare setup.
Per il mandato ricevuto il gate precede codice, piani, design, architettura e API.
L'owner non ha letto/modificato credenziali né effettuato chiamate live.

Quota riferita dalla regia79% usato, uso ordinario consentito; stop nuovi lotti85%,
tetto90%, senza reset/acquisto. Attendere nella regia la decisione già richiesta;
solo dopo un eventuale sblocco riprendere il mandato concreto entro quota.
Questo turno termina con sola preservazione/documentazione: nessun codice,
test applicativo, import, deploy, automazione o accesso browser/WhatsApp.
Main locale5118217, origin/main058d698 dopo fetch; un commit locale avanti,
checkout già modificato preservato, nessun pull/commit/push.
