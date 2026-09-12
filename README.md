# FieldTrack

App per attività di costruzione e commissioning, migrata dal prototipo Figma/Vite a **Next.js 16 App Router, React 19 e TypeScript**. UI mobile per operatori, dashboard per supervisori e manager, backend Next.js e PostgreSQL su Neon tramite Drizzle.

## Avvio locale

Richiede Node.js 22 o superiore (consigliato 24 LTS).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Apri [localhost:3000](http://localhost:3000). Senza `DATABASE_URL`, in sviluppo è disponibile la demo con dati sintetici. Per Tony: azienda **alternativeHEAT**, utente **Tony McIntyre · manager**. Marco Rossi è l’operatore; Anna Bianchi è il supervisore.

La demo conserva temporaneamente i dati nella memoria del server locale. Non scrive JSON o dati applicativi nel browser e non simula persistenza su Vercel. Un riavvio del processo li azzera. Con `DATABASE_URL` impostata, tutti i salvataggi usano Neon, il selettore demo viene disabilitato e l’accesso richiede email/password. Un errore del DB non attiva mai la demo come fallback.

## Collegamento a Neon

1. Crea un progetto e un branch Neon dedicato. Inserisci la connection string pooled in `DATABASE_URL` in `.env.local`. È un segreto **solo server**, senza prefisso `NEXT_PUBLIC_`.
2. Imposta opzionalmente `DATABASE_URL_UNPOOLED` per le migrazioni e `DEMO_MODE=false`.
3. Esegui la migrazione versionata:

   ```sh
   npm run db:migrate
   ```

4. Crea il primo account reale e il progetto, senza importare dati di esempio:

   ```sh
   npm run db:provision -- --email tony@example.com --name 'Tony McIntyre' --company 'alternativeHEAT' --project 'AMS16' --location 'Amsterdam' --role manager
   npm run db:set-password -- tony@example.com
   ```

   Sostituisci l’email d’esempio. La password viene richiesta nel terminale senza mostrarla; minimo 12 caratteri. Non passarla negli argomenti della shell. La rotazione della password revoca le sessioni esistenti.

5. Ripeti `db:provision` per operatori e supervisori (`--role worker` / `supervisor`), usando lo stesso nome progetto e la rispettiva azienda. L’azienda e il progetto esistenti vengono riutilizzati se il nome è univoco. Il comando non cambia i ruoli di account già presenti. Per assegnare account esistenti ad altri progetti, inserisci l’associazione in `project_memberships` tramite amministrazione DB.

Per un branch **esclusivamente di collaudo**, `npm run db:seed -- --demo` aggiunge dati sintetici senza sovrascrivere record esistenti. Non è una migrazione automatica dei dati del vecchio prototipo. Gli utenti del seed non hanno password finché non vengono impostate singolarmente.

## Deploy su Vercel

- Importa questo repository; framework **Next.js**.
- Node.js **24.x**; installazione `npm ci`, build `npm run build`, output predefinito Next.js. Non impostare `dist`, export statico o rewrite da SPA.
- Configura `DATABASE_URL` e `DEMO_MODE=false` negli ambienti opportuni; usa un branch DB distinto per le preview.
- Esegui `db:migrate` dal terminale sul DB di destinazione prima del deploy. Le migrazioni e il seed non vengono eseguiti nella build.
- Crea gli account e imposta le password. Poi prova accesso, attività, upload, aggiornamento e refresh su due dispositivi.
- Scegli, se possibile, una regione Vercel vicina a quella Neon.

La demo in memoria è disabilitata su Vercel anche se `DEMO_MODE=true`: senza database viene mostrato lo stato di configurazione incompleta. La build funziona senza credenziali e non tenta connessioni al DB.

I comandi di sviluppo/build usano il compilatore Webpack supportato da Next.js; evitano il processo interno di Turbopack che non può aprire socket nell’ambiente locale di esecuzione usato per questa migrazione.

## Comandi e verifica

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run format:check
```

`npm test` verifica ruoli, appartenenza ai progetti, transizioni, input, CSV, password, SQL e vincoli PostgreSQL con PGlite in memoria. Non contatta Neon.

Per verificare le API, avvia una **demo locale isolata** con `npm run dev`, poi:

```sh
TEST_BASE_URL=http://localhost:3000 npm run test:api
```

Il test aggiunge attività, evidenze, feedback e turni sintetici; rifiuta ambienti diversi dalla demo. Un riavvio pulisce quei dati. Il test non usa il database reale.

## Struttura

- `src/app`: pagine App Router, layout protetti e API; i dettagli hanno URL permanenti `/tasks/:id` e `/shifts/:id`.
- `src/app/components`: UI derivata dal prototipo e componenti per attività/feedback.
- `src/lib`: modelli condivisi, regole dei ruoli e workflow, validazione Zod, CSV.
- `src/server`: sessioni, autorizzazione, repository e handler; moduli marcati `server-only`.
- `src/server/db` e `drizzle`: schema relazionale e migrazione SQL versionata.
- `scripts`: migrazione, provisioning, password e seed esplicito.
- `tests`: regressioni e test API.
- [Decisioni e passi successivi](docs/architecture.md).

Progetto Figma originale: [Mobile Time Tracking App](https://www.figma.com/design/DHcBe2jWzudcxYvxARTKFU/Mobile-Time-Tracking-App). Le schermate e il documento forniti sono stati usati come contesto funzionale; le integrazioni esterne non sono state attivate.
