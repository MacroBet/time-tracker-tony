# Piano di attivazione FieldTrack AI — 10 novembre 2026

**Superato per l’esecuzione Production dal [piano v2](activation-20261110-plan-v2.md):
DATABASE_URL redatta dalla CLI, nessuna connessione esportata o sostituita.**

Piano `tony-ai-activation-20261110-v1`, nel job già autorizzato
`tony-ai-assistant-entry-20261110`. **Preparazione; nessuna migrazione remota eseguita.**
Il consenso al riuso della chiave è già acquisito. La scrittura DB richiede invece
approvazione specifica di questo piano secondo AGENTS.md57–59.

## Target verificato e collegamento DB da confermare

La regia riferisce una nuova lettura UI diretta del child: account corretto macrobet,
team **macrobets-projects**, progetto **time-tracker-tony** accessibile.
Ambiente da modificare **Production**, sito `https://time-tracker-tony.vercel.app`.
Il precedente404 appartiene al vecchio account e non è il blocco attuale.
Elenco env senza filtri: presenti solo **DEMO_MODE** e **DATABASE_URL**, entrambi
con scope Production/Preview; assenti OPENAI_API_KEY, OPENAI_MODEL e COPILOT_ENABLED.
Nessun valore letto/reveal o modifica eseguita da questa verifica.

L'operatore abilitato deve confermare che il DB usato dal runner sia proprio quello
della DATABASE_URL di Production del progetto; non basta che sia un Neon raggiungibile.
Il candidato ricavato dalla configurazione locale già esistente (solo host/database,
nessun URL/password) è nel file privato
`output/tony/ai-assistant-20261110/activation-target.private.json`.
Il match candidato↔Production non è ancora attestato. Il runner richiede host e
nome database attesi espliciti e rifiuta un target diverso. Non modificare o
mostrare la connessione per ottenere il match; confermare tramite metadata della
connessione/integration già autorizzata. Nessuna nuova credenziale o servizio.

## Configurazione server consentita in parallelo, AI spenta

File minimale già preparato: **`/private/tmp/tony-ai-activation-20261110.env`**,
permessi0600; sorgente della sola chiave: `.env.local` FieldTrack già autorizzata.
Contiene esclusivamente:

- OPENAI_API_KEY: il valore esistente, mai stampato o copiato in chat/Git;
- OPENAI_MODEL: `gpt-5.6-terra`, modello provato nel test sintetico;
- COPILOT_ENABLED: `false`.

Nella UI Import.env del progetto verificato scegliere **solo Production** e
protezione Secret/Sensitive per la chiave. Non importare l'intero.env, non includere
DATABASE_URL/UNPOOLED/DEMO_MODE e non cambiare Preview. Se nel frattempo compare una
chiave omonima, fermarsi senza sovrascriverla: l'assenza era un'osservazione puntuale.
Confermare soltanto nomi/scope/presenza, senza reveal. Questa preparazione non
abilita AI; un redeploy con false resta disabilitato. Per evitare deploy inutili,
coordinare l'unico redeploy di attivazione dopo schema pronto e flag true.

## Migrazione scoped pronta alla revisione

File SQL immutabile approvabile: `drizzle/0006_openai_meter_observations.sql`.
SHA256: `cbaecd91b57e339d5577c86a439509ec690e90186b8fc2afe70e7e5966a95c04`.
Il runner dedicato `scripts/migrate-openai-meter.ts` usa solo questo file verificato,
non lancia il migrator generale su tutte le migrazioni pendenti.

Default dry-run di sola lettura: verifica target atteso, schema/journal Drizzle,
identità hash0–5 e assenza di migrazioni sconosciute o future. Richiede0005 come
ultima migrazione prima di applicare0006; schema meter deve essere assente.
Se0006 è già registrata e tabella coerente, esito no-op verificato. Se la tabella
esiste senza journal corretto o il journal diverge, STOP: nessun baseline/replay,
DROP o riparazione automatica di migrazioni storiche.

Dopo approvazione umana specifica: applicazione atomica della sola CREATE TABLE0006
più la corrispondente registrazione nel journal Drizzle. Una collisione/race deve
fallire con rollback della transazione, senza rimuovere tabelle già esistenti.
Verifica finale target/journal/schema e readiness di lettura della tabella.
Nessuna chiamata OpenAI è necessaria per il dry-run o l'applicazione.

Isolamento: unica nuova tabella metadata `openai_meter_observations`, primary key
attempt_id/phase, JSON limitato16KB, niente FK cascade/trigger o modifiche a
projects/tasks/membership/assets/P6/bootstrap. Preservare305task e18assegnazioni;
nessun reimport, seed, workflow o dato sintetico in produzione.
Intent e finale metadata immutabili: duplicato identico no-op, conflitto rifiutato;
finale fallito conserva pending. Nessun retry automatico della chiamata a pagamento.

Dry-run locale già dimostrato dal lotto: PGlite su schema/table e recorder,
idempotenza/conflitti, identità, pending al guasto e timeout di persistenza.
Il runner aggiunge test locali specifici su target/storico/applicazione selettiva.
Nessuna prova remota sostituita con questi test.

## Verifica e attivazione finale

1. Dopo import env mantenere COPILOT_ENABLED=false finché target e schema non sono
   verificati e l'applicazione0006 approvata/conclusa.
2. Verificare `ensureMeterReady()` nel contesto Production usando la connessione
   già attestata. Il codice interroga la tabella reale: nessuna deduzione da URL
   presente e nessun ripiego su /tmp o OPENAI_METER_DIRECTORY.
3. Solo dopo esito positivo impostare COPILOT_ENABLED=true e fare un solo redeploy
   della release applicativa **20a42ff3b4c72392a428c282f7bf6dc6027ede67** con le env
   aggiornate. Registrare nuovo deployment Production/success; il success già
   verificato7691342676 dimostra il codice precedente alla configurazione.
4. Controllare da utente autorizzato la readiness Copilot, progetto e modello;
   collaudo readonly circoscritto ricerca con totale rispetto al registro e link,
   senza modifiche/conferme di task, senza audio/chat/allegati WhatsApp o P6 intero.
   Verificare intent/finale e usage effettivi; costo billed sconosciuto resta null.

Rollback conservativo: impostare COPILOT_ENABLED=false e ridistribuire; se serve
ripristinare la release applicativa precedente. Conservare tabella/journal/metadata
per non perdere pending o osservazioni; nessun DROP/cancellazione come rollback.
Un'eventuale rimozione richiede export privato verificato e nuova decisione.

## Domanda di approvazione concreta per la regia

Dopo che il match DB Production è stato verificato e mostrato come host/database
senza credenziali:

> Autorizzi sul DB Production già collegato a time-tracker-tony la sola migrazione
> 0006 del piano tony-ai-activation-20261110-v1, con preflight storico/target,
> creazione atomica della tabella metadata e journal, nessuna modifica ai dati
> cliente e rollback tramite disabilitazione AI conservando il meter?

La risposta sulla chiave già ricevuta non è la risposta a questa operazione DB.
Il presente file prepara la domanda; non dichiara approvazione o esecuzione.

## Comandi dedicati e sequenza per l'operatore

Il runner usa **DATABASE_URL**, come l'app, e non preferisce automaticamente
UNPOOLED; l'eventuale `--connection DATABASE_URL_UNPOOLED` è una scelta esplicita
soggetta allo stesso confronto host/database. Nessuna connessione in argomento:
solo i nomi attesi non segreti. Source env già esistente, nessuna nuova credenziale.

Dopo match del DB Production e prima della richiesta di scrittura, il preflight
read-only è:

```sh
node --import tsx scripts/migrate-openai-meter.ts \
  --target macrobets-projects/time-tracker-tony:Production \
  --expected-host HOST_PRODUCTION_VERIFICATO \
  --expected-database NOME_DB_VERIFICATO
```

Dopo risposta umana specifica sul piano e sul target, stesso comando più:

```sh
  --apply --approval-id ID_MESSAGGIO_APPROVAZIONE_MARCO
```

L'approvazione va verificata dalla regia; scrivere un ID nella CLI non la crea.
L'applicazione acquisisce lock transazionale, ripete i controlli sul journal per
rilevare una race, quindi DDL0006 e journal nella stessa transazione.
Successo e seconda esecuzione no-op vanno verificati; non modificare hash/journal
per superare un errore. Il runner non abilita AI, non chiama OpenAI, non importa dati.
