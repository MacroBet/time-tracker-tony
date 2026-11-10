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


### Commit e blocco runtime verificato

Commit applicativo **20a42ff3b4c72392a428c282f7bf6dc6027ede67**, push normale su
main concluso; HEAD e origin/main coincidono. Il commit conserva anche il precedente
5118217 già locale e non altera la cronologia. Deploy Vercel in verifica separata.

La regia riferisce l'ultimo controllo CUA read-only: sessione Chrome autenticata,
ma URL `vercel.com/macrobets-projects/time-tracker-tony` restituisce404/Not Found
per quell'account. Non è un semplice login mancante: non sono visibili progetto,
nomi env o valori. Nessun cambio account o retry. Occorre un account con accesso
al team/progetto esatto per verificare configurazione e percorso migratorio cloud.
Il codice runtime resta fail-closed finché enable/key/storage effettivi non sono pronti.
Questa è una dipendenza operativa concreta, non una nuova domanda sulla chiave.

Nomi da verificare senza reveal: `OPENAI_API_KEY` (solo quella di FieldTrack già
autorizzata, senza sostituire secret diverso), `COPILOT_ENABLED`, eventuale
`OPENAI_MODEL` (default nel codice se assente), `DATABASE_URL` per il database
esistente. `OPENAI_METER_DIRECTORY` non è richiesto in produzione: l'adapter usa
Neon e non usa un filesystem temporaneo. Nessuna chiave richiesta in chat.


### Rilascio effettivo verificato

Commit app **20a42ff3b4c72392a428c282f7bf6dc6027ede67**, pubblicato su main;
GitHub Vercel check success e deployment **7691342676 / Production / success**,
**10nov18:56:54UTC =19:56:54 Europe/Rome**. Vercel ID
`7PxyGBaHRY5zM6eNuqVes6eJQH4E`.
[Deploy](https://vercel.com/macrobets-projects/time-tracker-tony/7PxyGBaHRY5zM6eNuqVes6eJQH4E),
[URL immutabile](https://time-tracker-tony-kz5p5gy9d-macrobets-projects.vercel.app),
[alias pubblico](https://time-tracker-tony.vercel.app/).
Alias risponde200 e restituisce Permissions-Policy microphone=(self).
Questa prova non è collaudo autenticato online di ricerca/voce/Neon.

**Stato finale: codice pubblicato; attivazione runtime bloccata**, non job completo.
Nessuna migrazione remota applicata o presenza env cloud dichiarata. Account Vercel
controllato dalla regia non accede al progetto; non ritentare quello stesso account.
Prossimo passo preciso: account abilitato al team verifica target/env e normale
Build Command; approvazione/applicazione della sola0006 secondo il piano sopra,
quindi readiness e prova sintetica online. Riuso chiave già autorizzato, nessuna
nuova domanda o nuova chiave. Quota finale82% usato, uso ordinario consentito.

Ricevute private: `output/tony/ai-assistant-20261110/deploy.private.json` e
`validation.private.json`. Aggiornamento documentale di chiusura locale distinto
dal commit app; nessun ulteriore deploy richiesto per la sola documentazione.


Aggiornamento umano successivo alla prova di deploy: Marco riferisce **«Ho aperto
il progetto con l’account corretto»**. La regia ha incaricato lo stesso child di
verificare target e soli nomi env. Il precedente404 è storico del primo account;
non è più un blocco attuale confermato. Verifica nuova sessione ancora pendente,
nessuna configurazione o migrazione eseguita da questo owner; non duplicare browser.

Identità del piano migratorio revisionabile: `0006_openai_meter_observations.sql`,
SHA256 `cbaecd91b57e339d5577c86a439509ec690e90186b8fc2afe70e7e5966a95c04`. Il normale build verificato non lo esegue.

## Collaudo Production delegato e correzione conteggi P6

Il10nov la regia riferisce CUA reale come Test admin/Admin nel progettoLHR11
`08ef7190-c42e-46fc-9e2e-873d5c84dd0b`: registro1354asset; chiller0 e rispostaAI0
coerenti; secondo controllo su un tipo presente, registro2 e rispostaAI2, entrambi
mostrati. Il link di un risultato apre la scheda corretta nello stesso progetto.
Due query chat, nessun audio/edit o risultato esterno osservato. È prova delegata,
non una seconda sessione di questo owner né misura del numero di chiamate provider.

Difetto emerso: il riepilogo Copilot chiamava «programme activities» soltanto le
righe gestite nell’app, mostrando0 mentre il P6 sorgente contiene16969attività.
Correzione minima: conteggi distinti `managedProgrammeActivities` e
`importedProgrammeActivities` (null se nessuna sorgente importata). Il secondo usa
soltanto `sourceProgrammeSummary.activities` già disponibile, senza leggere/esportare
l’archivio. Header, stato vuoto, descrizione del tool esistente `project_summary`
e limitations distinguono le due nature. Le verifiche e scadenze legate all’app
continuano a usare le attività gestite; nessun ricalcolo delle date P6 o accessoAI
alle16969righe, relazioni o calendari viene dichiarato.

Verifica della correzione:6test mirati (2nuovi), lint, detector UI e build normali
superati. Nessuna migrazione/DBwrite o nuovo toolAI. Ricerca e link già PASS non
ripetuti a pagamento. `next-env.d.ts` preesistente ripristinato byte per byte.

Metering: schema/journal Production verificati in attivazione. Il successo delle
risposte è evidenza indiretta del percorso che attende intent e finale suNeon;
non è una lettura diretta delle righe collector. L’owner non dispone di accesso al
collector Production: token misurati e costo billed restano null.821token sono
soltanto della precedente prova sintetica locale. Nessuna nuova esportazione,
connessione locale promossa a Production o endpoint metering aggiunto.

Bozza inglese di conferma conservata privatamente in `output/tony/ai-assistant-20261110/`,
pronta solo dopo verifica della release corretta; nessun invio/composer o vecchio
consenso riutilizzato. Testo raw fuoriGit. Quota nativa prima/dopo fix86%, ordinary
allowed, cap90; questo è chiusura di difetto del lotto esistente.
