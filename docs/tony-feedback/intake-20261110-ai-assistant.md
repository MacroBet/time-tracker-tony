# Assistente asset, Equipment e Tasks — 10 novembre 2026

## Mandato e limiti

Job manuale `tony-ai-assistant-entry-20261110`, request
`tony-ai-assistant-entry-request-20261110`, owner Tony, scadenza10nov.
Fonte: delegazioni della regia `01a1493a-ee0b-7d62-a861-d8d546bf013c`.
Marco ha risposto **«Riusa la chiave già presente»** alla domanda sul riuso,
item0 di `call_4e894e753eb747bca5f7a070ab53d497`. Gate soddisfatto per questa
funzione sul sito FieldTrack; nessuna nuova chiave, servizio o spesa extra.
Il turno di sola preservazione è concluso; [fonti e incidente](intake-20261110-context-incident.md)
restano distinti dal presente mandato esecutivo. Nessun invio WhatsApp autorizzato.

Riferimenti PNG conservati privatamente; ZIP ignorato. Tre child con ownership
separata hanno eseguito backend ricerca, voce e incrementi Equipment/Tasks;
root ha integrato, corretto link/cambio progetto, verificato schermate e permessi.
Il child backend ha poi ricevuto il completamento del metering Neon, stesso lotto.

## Comportamento implementato

- Ingresso compatto AI/microfono e tastiera nell'header FieldTrack, senza raster
  gigante o rebranding. Apre il Copilot nel progetto assegnato; nessun ascolto o
  invio all'apertura. Worker escluso secondo il gate esistente, anche nelle API.
- `search_assets` cerca sull'intero inventario autorizzato del progetto: query,
  equipmentType, location, phase; totale esatto, pagine massime20 e output limitato
  per byte. Risultati strutturati separati dal testo del modello. Il collegamento
  «Open all» applica lo stesso predicato alla lista Assets; link al singolo asset,
  progetto verificato e filtri cancellabili. Nessun campione presentato come tutti.
- Voce su click e permesso browser: PCM WAV mono16kHz, massimo30s/960044byte,
  timer/stop esplicito. Tracce fermate su uscita, cambio progetto o pagina nascosta.
  Transcript rivedibile nel composer, poi invio manuale. Limiti server verificati
  prima della chiamata: auth/moduli/membership, origin, formato/durata, timeout20s,
  risposta32KB/testo4000caratteri. Audio non conservato. Permissions-Policy consente
  microfono same-origin; il permesso browser resta richiesto soltanto al click.
- Equipment status con medesimi filtri/pagine del registro: test e tag review
  separati per livello configurato, checksheet risposte/firme reali e issue aperte.
  Nessun KPI o mapping colori/approvazioni dedotto. Dati mancanti espliciti.
- Percorso admin effettivo `ManagementBoard`: contesto equipment/livello nelle
  righe e drawer con test/review/checksheet separati. Worker: contesto equipment
  sulle card già assegnate. Nessuna nuova schermata, assegnazione o import.
- Proposte di modifica restano preview e conferma separate, legate a sessione,
  utente, versione task/progetto e scadenza; nessun Autopilot o scrittura da prompt.

## API, modello e tracciamento

Default server soltanto se modello non configurato: `gpt-5.6-terra`, effort low;
configurazione esplicita preesistente preservata. La pagina GPT-5 Mini consultata
lo indica deprecato e rimanda a Terra per nuovi carichi: scelta aggiornata, senza
cambiare modelli Codex. Responses strict function calling, endpoint fisso,
store=false e limiti preesistenti preservati. Trascrizione `gpt-transcribe`.

Fonti primarie consultate10nov:
[function calling](https://developers.openai.com/api/docs/guides/function-calling),
[GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra),
[trascrizione](https://developers.openai.com/api/docs/guides/speech-to-text).
Le guide Next installate sono state lette; Impeccable/craft-floor applicati al
sistema visivo esistente, detector senza rilievi. Nessuna identità visiva nuova.

Il provider deve registrare intento prima del trasporto e risultato finale;
storage assente/non scrivibile impedisce chiamate a pagamento. Nessun ripiego
su /tmp in produzione né disattivazione del recorder. Il successivo adapter Neon
usa una tabella dedicata ai soli metadata, senza commissioning._audit, prompt,
audio, segreti, update progetti/task o modifiche a membership. Migrazione additiva
preparata; attivazione remota e configurazione cloud vanno provate separatamente.

## Prove disponibili

42 test unitari mirati tra ricerca, PCM/trasporto, proposte, provider e metering
prima del completamento adapter Neon; due test API su demo isolata verificano
401/403/404, revoca moduli, origin e conferme/versioni. Le verifiche adapter Neon
successive e il build finale sono riportati nella ricevuta di rilascio.

Collaudo browser su demo sintetica isolata (DB remoto e AI disabilitati): desktop
1440px e mobile390px, risultati stub esplicitamente sintetici; query/lista con
stesso totale, deep link, cambio progetto senza ritorno al vecchio link, matrice,
Tasks admin reale/drawer e worker. Microfono Chrome con dispositivo audio finto:
registrazione/stop, WAV reale intercettato localmente e transcript non inviato
automaticamente. Zero pageerror e nessun overflow orizzontale del documento.
Screenshot e ricevute: `output/playwright/ai-assistant-20261110/`.
Root ha aperto e verificato le immagini; la regia ha confermato il tab Equipment
nella cattura stabile. Il primo screenshot aveva la transizione colore incompleta,
non uno stato selezionato errato. Nessun collaudo reale del microfono fisico o
trascrizione live dichiarato da questa prova.

Test OpenAI separato con sola chiave del repo in memoria e dati sintetici:
una chiamata tool e risposta con totale25 corretto. Due risposte riuscite,
735input token +86output token =821total,8reasoning inclusi negli output;
un precedente tentativo di rete fallito con usage sconosciuto registrato separatamente.
Costo billed/estimate **null**. Modello effettivo `gpt-5.6-terra`.
Nessun WhatsApp/allegato, inventario cliente o P6 inviato all'API.
Ricevuta privata `output/tony/ai-assistant-20261110/live-smoke.private.json`.

## Stato di rilascio e ripresa

Integrazione locale verificata; commit/push/deploy esatti e stato runtime vengono
aggiunti alla chiusura. Nessuna migrazione remota o configurazione cloud eseguita
in questa fase. Nessun tool Vercel autenticato, CLI installata, file auth locale
nei percorsi convenzionali o VERCEL_TOKEN nel processo: metadata env cloud non
letti, né presenza locale interpretata come setup online. Non cercate credenziali
alternative e nessun valore letto/stampato da dashboard.

Per attivare online servono, sul progetto Vercel esistente `time-tracker-tony`
di `macrobets-projects`, la verifica dei soli nomi/presenza della chiave prevista,
enable flag e storage metadata. Non sovrascrivere un secret cloud diverso.
Per il nuovo store Neon va approvata/applicata la migrazione additiva esatta sul
DB esistente verificato; il mandato5nov autorizzava azioni scoped dell'app,
non SQL amministrativo. Piano concreto, isolamento e rollback nella sezione di
chiusura prima di qualsiasi richiesta di approvazione. La readiness interroga lo
storage effettivo e non si deduce da DATABASE_URL.

Baseline Gantt058d698 e dati clienti preservati; next-env.d.ts preesistente
escluso dai commit. Quota misurata80→81→82% usato, ordinaryUsageAllowed=true,
stop nuovi lotti85/cap90; nessun reset, acquisto o nuovo scheduler.

### Migrazione pronta per revisione, non eseguita da questo owner

Artefatti: `drizzle/0006_openai_meter_observations.sql`, journal/snapshot Drizzle,
`src/server/openai-meter-db.ts`. Unica nuova tabella
`openai_meter_observations(attempt_id, phase, observation, recorded_at)`;
chiave composta attempt_id/phase, JSON metadata limitato16KB e vincoli di fase.
Nessuna FK cascade, trigger, update bootstrap o documento commissioning.
Intent pending immutabile e risultato final immutabile: duplicato identico idempotente,
conflitto rifiutato. Un errore di persistenza finale lascia pending/sconosciuto;
si ritenta soltanto la persistenza, mai automaticamente la richiesta API pagata.
Export privato paginato, nessun endpoint pubblico o watcher.

Piano operativo da approvare sul target verificato: identificare il database Neon
**già collegato** al progetto Vercel nominato sopra senza esporre URL/credenziali;
verificare journal e che0006 sia l'unica migrazione pendente, quindi applicare solo
il normale percorso migratorio del repository. Non eseguire alla cieca tutte le
migrazioni pendenti né SQL alternativo. Isolamento: nuova tabella telemetria;
305task/18assegnazioni e inventario/P6 non sono target della migrazione.
Dry run: PGlite locale, assenza tabella/readiness, append/idempotenza/conflitto,
final failure/pending e nessuna modifica ai dati cliente. Prove remote ancora assenti.

Rollback operativo: disabilitare `COPILOT_ENABLED` e tornare alla precedente release
se necessario; conservare la tabella e i metadata già raccolti, senza DROP o
cancellazione di audit. L'eventuale rimozione strutturale richiederebbe export privato
verificato e consenso separato. Solo dopo schema/storage pronti e presenza della
chiave attesa verificata, impostare enable flag e verificare runtime con input
sintetico limitato; nessun segreto diverso sovrascritto e nessun nuovo provider.


### Chiusura verifiche locali

Adapter Neon e persistenza asincrona conclusi:36test mirati finali passati
(6nuovi PGlite/async più30provider/audio/spool), inclusi tabella assente,
identità intento/finale, final persistence appesa con timeout5s e pending.
Con ricerca/domain/proposte già verdi,48unitari univoci verificati nel lotto;
2integration API passati. Build finale completo e typecheck superati dopo
integrazione Neon; lint mirato e detector senza rilievi.

Nel repository `build` esegue soltanto `next build --webpack`; non esistono
vercel.json o workflow .github, e `db:migrate` è uno script distinto che applica
le migrazioni del journal. Non è verificato un eventuale override Build Command
cloud. Nessuna migrazione eseguita automaticamente dall'owner.

La regia ha aperto le catture desktop/mobile/worker e non rileva altri blocchi
visivi; non serve un altro giro di screenshot. Processi locali e Chrome di test
chiusi. next-env.d.ts ripristinato byte-per-byte allo stato precedente al lotto;
nessun file privato in Git. Rilascio applicativo ora pronto per commit/push normali.
