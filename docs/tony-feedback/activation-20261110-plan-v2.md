# Piano v2 — sola0006 nel build Production FieldTrack

Piano **`tony-ai-activation-20261110-v2`**, stesso job manuale
`tony-ai-assistant-entry-20261110`. Preparato e testato localmente; **non eseguito
su DB remoto**. Sostituisce il match fisico richiesto dal [piano v1](activation-20261110-plan.md):
la CLI Vercel restituisce DATABASE_URL redatta, limite rispettato senza tentativi
di recupero del segreto. Il candidato DB locale NON viene promosso a target.

## Target esatto e connessione già prevista dal backend

Target: **database configurato nella Production del solo progetto Vercel**
`macrobets-projects/time-tracker-tony`, ID
`prj_hqtnQUnlqpG0tpjFM49p0Q73m9Vz`, sito `https://time-tracker-tony.vercel.app`.
Progetto/account macrobet e ID verificati tramite UI delegata e CLI ufficiale.
Org ID verificato dal link: `team_h8XmGMkuuV40uY9S8M7s0rmy`.

Il runner viene eseguito nel normale build Vercel che già riceve DATABASE_URL,
come l'app. Non esporta/legge la connessione via dashboard e non usa .env locale.
Prima di costruire il client DB, `--vercel-production` richiede:

- `VERCEL_ENV` esattamente `production`;
- `VERCEL_PROJECT_ID` esattamente `prj_hqtnQUnlqpG0tpjFM49p0Q73m9Vz`;
- target logico fisso del progetto sopra; se presenti, PROJECT_NAME e
  PROJECT_PRODUCTION_URL devono corrispondere al progetto/sito;
- per apply: approval ID valido e uguale a `FIELDTRACK_METER_MIGRATION_APPROVAL`.

Se le system env non sono esposte o divergono, STOP prima della connessione;
non sintetizzarle da un altro progetto per superare il controllo.
Solo DATABASE_URL iniettata, nessun fallback a UNPOOLED/dotenv/altre connessioni.

## Patch pronta e gate spento

- `scripts/vercel-build.ts`: entrypoint di `npm run build`; senza approval gate
  esegue soltanto il precedente `next build --webpack`, senza accesso migratorio.
- `scripts/migrate-openai-meter.ts`: default dry-run readonly; modalità Vercel
  protetta sopra, apply solo con approvazione esatta.
- `src/server/openai-meter-migration.ts`: SHA, storico, schema e transazione scoped.
- Test locali PGlite/guardie in `tests/openai-meter-migration.test.ts` e
  `tests/vercel-build.test.ts`. Nessun endpoint nuovo o servizio/credenziale nuovo.

La nuova env di approval **non è stata impostata**, nessun build write remoto
avviato. Il consenso umano non viene creato da una stringa nella CLI/env: la
regia deve prima ricevere e verificare la risposta specifica a questo piano.

## Operazione dopo approvazione specifica

1. Nel solo Production del progetto verificato registrare l'ID della risposta
   umana in `FIELDTRACK_METER_MIGRATION_APPROVAL`; tenere `COPILOT_ENABLED=false`.
   Non cambiare DATABASE_URL, Preview, ruoli, servizi o chiavi.
2. Pubblicare la patch del build con normale commit/push autorizzato, verificando
   lo SHA effettivo. Il Build Command verificato è `npm run build`/defaultNext;
   il wrapper mantiene lo stesso build ed esegue la migrazione solo con il gate.
   Non ridistribuire il vecchio20a42ff aspettandosi il nuovo wrapper.
3. Il wrapper chiama esclusivamente runner0006 in modalità Vercel. Prima di
   scrivere, preflight readonly in snapshot: journal Drizzle deve coincidere
   esattamente con hash/timestamp0000–0005 e meter assente. Niente migrazioni
   future/sconosciute/gap, vecchi DDL o baseline automatica. Se0006 è già registrata,
   verificare colonne/PK/CHECK effettivi e terminare no-op.
4. Solo se preflight passa: lock transazionale/advisory, controllo storico ripetuto,
   **CREATE TABLE0006 + sua riga journal nella stessa transazione**. Race/conflitto
   interrompe senza replay di altri file. Verifica readonly finale0006/schema.
5. Il build Next prosegue dopo successo. Registrare SHA/deployment Production e
   risultato; mantenere AI=false fino alla verifica dello storage. Rimuovere il
   gate approval dopo la singola operazione riuscita; non lasciare migrazioni
   richieste ad ogni build.
6. Solo con meter verificato, impostare COPILOT_ENABLED=true e ridistribuire la
   release corretta con configurazione aggiornata. Verificare readiness autenticata,
   lookup readonly circoscritto/totalità e metadata intent/finale; nessun write task.

## Identità, isolamento e idempotenza

Unico SQL: `drizzle/0006_openai_meter_observations.sql`, SHA256
`cbaecd91b57e339d5577c86a439509ec690e90186b8fc2afe70e7e5966a95c04`.
Nuova sola tabella `openai_meter_observations` con intento/finale metadata;
nessun prompt/audio/segreto. Modifica aggiuntiva soltanto al journal Drizzle della
stessa migrazione. Nessuna FK cascade/trigger; niente update a clienti, progetti,
305task/18assegnazioni, inventario/P6, membership o bootstrap.

Secondo apply con journal/schema coerenti è no-op. Tabella non tracciata, CHECK
alterato pur con nome identico, storico differente o checksum diverso bloccano.
Nessun `db:migrate` generale né SQL arbitrario. Lo script non chiama OpenAI.
Dry-run/apply/rollback transazionale/idempotenza e guardie sono verificati localmente
su PGlite/adattatori; nessuna prova locale dichiarata come prova remota.

Rollback conservativo: `COPILOT_ENABLED=false`, rimuovere gate e ridistribuire;
se serve tornare alla release applicativa precedente. Conservare tabella, journal,
intenti pending e metadata esistenti. Nessun DROP/cancellazione di telemetria o
retry di una richiesta API a pagamento per riparare un errore di persistenza.

## Stato configurazione già conclusa

Login CLI ufficiale riuscito come macrobet; link al progetto esistente, nessun
token manuale/cookie letto. La CLI ha aggiunto automaticamente un OIDC locale,
rimosso senza usarlo; chiave FieldTrack preservata e file privati0600.

Import UI non eseguito (richiedeva permesso estensione più ampio, non concesso).
Configurazione eseguita invece via stdin CLI, verifica nomi prima/dopo e nessun
force/overwrite: solo Production, **OPENAI_API_KEY Secret**, **OPENAI_MODEL
`gpt-5.6-terra` Config**, **COPILOT_ENABLED=false Config**. Confermate insieme a
DEMO_MODE e DATABASE_URL già presenti. Nessun redeploy o abilitazione AI.
Ricevuta privata `output/tony/ai-assistant-20261110/cloud-config.private.json`.

## Domanda esatta per Marco nella regia

> Autorizzi il piano tony-ai-activation-20261110-v2: eseguire nel build Production
> del progetto Vercel time-tracker-tony (prj_hqtnQUnlqpG0tpjFM49p0Q73m9Vz), usando
> la sua connessione DB già configurata, la sola migrazione0006 per la tabella
> metadata API e la sua riga journal, con preflight storico, transazione e no-op
> se già applicata, senza modificare dati cliente e mantenendo AI disabilitata
> fino alla verifica?

Motivo della conferma, distinto dal riuso chiave già autorizzato:
[AGENTS.md](../../AGENTS.md) richiede per scritture DB remote «target esatto,
isolamento, dry run, idempotenza, rollback e nuova approvazione del piano».
Nessuna esecuzione remota è autorizzata dal solo presente documento.


Chiusura locale:8test mirati complessivi (6runner/PGlite/guardie +2wrapper) passati,
lint mirato e build normale senza gate passati. Nessuna migrazione remota o gate
approval impostato. File temporaneo plaintext per import eliminato dopo la ricevuta
CLI e la verifica dei cinque nomi Production; chiave originale nel repo preservata.
Quota verificata85% usato: nessun nuovo lotto; solo chiusura/revisione del presente piano.
