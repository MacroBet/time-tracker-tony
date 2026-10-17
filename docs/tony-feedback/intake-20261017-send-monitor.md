# 17 ottobre — invio approvato e monitoraggio ripreso

## Consenso e unico invio

Stesso job `tony-new-whatsapp-feedback-20261017`, nessun nuovo incarico/chat.
Verifica nativa `read_thread` della regia vocale `01a14934-2940-7e42-a69b-768811718988`:
bozza inglese esatta visibile nel turno01a14935-24fb-7fb2-a0ee-8e59b2515b9c;
conferma umana nel messaggio01a14935-72f9-7112-bc90-ce347f4bef14 del turno successivo.
L’eventuale precedente richiesta di modifica registrata in dashboard alle09:29UTC
è anteriore alla nuova conferma vocale sullo stesso testo; non è stata interpretata
come consenso. Il nuovo consenso è stato letto direttamente, non soltanto riferito.

Alias regia `tony-text-feedback-response-20261017` v1, stessa bozza locale
`tony-text-feedback-20261017` v1, destinatario Tony McIntyre, WhatsApp.
Hash **testo UTF-8** `sha256:4eda684818484c2d9f0f82f53732a893228b906166592df710fd668d845b7b6b`. Il binding locale
`sha256:a77b317d6ad039cf6180f7f22712063694f451e78bc68ac3f4c862d6c40332e8` include anche ID/versione/destinatario/ambito:
impronte diverse per contratti diversi, testo esatto identico verificato.

Deduplica: chat Tony verificata, ultimo incoming11:09, nessuna bolla corrispondente,
composer vuoto. Paste del testo esatto, verifica integrale AX. ClickSend iniziale
senza cambiamento, testo ancora nel composer e nessuna bolla; nuova lettura AX,
Return una volta produce **una bolla outgoing11:34**, medesimo testo, composer vuoto.
AX lista: Sent to Tony McIntyre / Sent. Screenshot: **una spunta grigia**, quindi
**invio verificato, consegna e lettura non attestate**. Nessun reinvio o altro testo.

Evidenza privata `output/tony/send-20261017-1134.private.json`, SHA-256
`ccb7170b5a55d67333c967ea595914a172f330a3bb0dce96b70214c6599a244b`. Testo/chat raw fuori Git; nessun audio o allegato nuovo.
Consenso consumato per un solo invio, ogni futuro messaggio richiede approvazione
puntuale. Stato coda regia ancora precedente al momento della lettura: il **publisher
autorizzato** deve riconciliare `tony-text-feedback-response-approval-20261017` con
queste prove. Nessuna scrittura ACL/reporter, impersonazione o callback interchat.
Handoff nel report condiviso; aggiornamento canonico della coda non dichiarato eseguito.

## Nuovi testi osservati durante la deduplica

Quattro incoming diretti11:06–11:09 aggiunti alla copertura, senza audio:

- 11:06: proposta di fonte dati/documenti condivisa per asset principale/tipologia,
  apribile per vedere la lista delle unità. Non equivale ancora a modello dati definito.
- 11:08: test specifici aprendo la singola unità sotto l’asset principale; risultati
  e approvazioni delle unità devono restare distinti dai documenti condivisi.
- 11:09: manager/admin dovrebbero aprire la home; Tony riferisce che ora apre Tasks.
  È richiesta UX concreta, **ancora da verificare e autorizzare come nuovo sviluppo**.
- 11:09: per il worker Tasks ha priorità, quindi ingresso differenziato per ruolo.

Lotto totale17ott:11testi10:56–11:09, non copertura continua della cronologia intermedia.
La bozza inviata approvata resta riferita al primo lotto fino11:04; non è stata ampliata.

## Nuovo mandato continuativo e ambito

Fonte umana diretta letta nella regia vocale, messaggio
01a14936-4c4c-7770-abc9-d468322dcf19 del turno01a14936-499a-7960-bc14-ba0574fea66d:
continuare a seguire Tony e pubblicare i filtri se li richiede. Supera la pausa
precedente per questo monitoraggio, non per nuove feature, altri invii o spese.

Strumento app `automation_update` riuscito: **stesso ID agente-progetto-tony ACTIVE**,
ogni dieci minuti, target questa chat01a1407b-ee5f-72a0-bc3e-f883cdd78130;
configurazione locale verificata dopo la modifica. Nessun nuovo scheduler/job,
nessuna attesa in loop qui. Prompt ristretto: solo delta testi/materiali, audio Marco,
nessuna app/DB/API live non autorizzata, silenzio invariato, nessun invio ripetuto.
ACTIVE è configurazione verificata, non prova di letture future senza desktop disponibile.

## Produzione: prove, target e limiti

App **d7dcb8f** già pubblicata prima del nuovo mandato, Vercel success09:12UTC.
HEAD documentale **e26ebd9** success09:13:37Z; deployment GitHub **7137476517**,
ambiente etichettato **Production**, status success09:13:38Z, URL
https://time-tracker-tony-k02dgep74-macrobets-projects.vercel.app . Il campo separato
GitHub production_environment è false, riportato senza usarlo per inventare alias.
Target Vercel progetto macrobets-projects/time-tracker-tony. Alias pubblico
https://time-tracker-tony.vercel.app/commissioning risponde200; ispezione anonima del
bundle non conclusiva perché il chunk Assets non è esposto in quell’HTML. Nessun
collaudo autenticato di produzione o accesso DB. La prova di deploy è nei metadati
GitHub/Vercel, distinta dai test autenticate esclusivamente locali già conclusi.
La precedente affermazione vocale di mancato deploy era non verificata ed è corretta.

Metadata privati in output/tony/production-deployment-metadata-20261017.private.json
e production-filters-20261017.private.json. **Nessun nuovo deploy necessario/eseguito**,
nessuna estensione ad altre feature. Richiesta futura esplicita di Tony: verificare
stato/target prima, senza pubblicazione duplicata se i filtri sono già presenti.

## Chiusura

Solo documentazione/configurazione monitor; nessuna modifica app o suite applicativa
ripetuta. Fetch main0/0 a e26ebd9, next-env preesistente preservato. Verifiche mirate
link/JSON/hash/formato/diff, commit/push normali. Publisher riceve il report condiviso
per consenso, invio e monitor; nessuna integrazione o aggiornamento dashboard attestati.
