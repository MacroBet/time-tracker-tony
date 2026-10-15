# FieldTrack

App per attività di costruzione e commissioning, migrata dal prototipo Figma/Vite a **Next.js 16 App Router, React 19 e TypeScript**. UI mobile per operatori, dashboard per supervisori e manager, backend Next.js e PostgreSQL su Neon tramite Drizzle.

## Riprendere l'agente progetto

Leggere [Agente progetto FieldTrack](docs/tony-feedback/README.md) e lo
[stato corrente](docs/tony-feedback/register.md). Il heartbeat **Agente progetto Tony**
è ACTIVE ogni 15 minuti nella chat locale: non crearne un duplicato. Il protocollo
contiene autorizzazioni, backlog, prove e gate DB/API; la chiave AI verrà fornita
più avanti da Marco. In questa fase nessuna scrittura su database remoto.

## Avvio locale

Richiede Node.js 22 o superiore (consigliato 24 LTS).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Apri [localhost:3000](http://localhost:3000). Senza `DATABASE_URL`, in sviluppo è disponibile la demo con dati sintetici. Per Tony: azienda **alternativeHEAT**, utente **Tony McIntyre · manager**. Marco Rossi è l’operatore; Anna Bianchi è il supervisore.

La demo apre **DEMO · Northbank commissioning**, un esempio sintetico con 28 asset,
100 attività programma e 120 task; dal selettore Project è disponibile anche
**DEMO · Start a project**, vuoto, per provare i primi passi. Le fixture sono
attivate solo dal repository della demo locale: non vengono aggiunte ai seed
preesistenti né caricate su Neon. Il [piano di demo e isolamento](docs/tony-feedback/local-demo-and-remote-plan.md)
spiega il perimetro e l'eventuale proposta remota, non eseguita.

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

5. Ripeti `db:provision` per operatori e supervisori (`--role worker` / `supervisor`), usando lo stesso nome progetto e la rispettiva azienda. L’azienda e il progetto esistenti vengono riutilizzati se il nome è univoco. Il comando non cambia i ruoli di account già presenti. Con un account admin puoi creare account/progetti e gestire l’accesso degli utenti esistenti dalla scheda Team.

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

## Flussi operativi

La matrice dei ruoli, i casi coperti e i limiti verificati sono in [Use case](docs/use-cases.md). Il supervisor coordina tutti i progetti assegnati al proprio account. Manager e supervisor possono assegnare e riassegnare issue, anche in gruppo (massimo 50), modificare il piano e approvare le consegne. Il worker invia in revisione con nota o evidenza, senza auto-approvare la chiusura.

L’interfaccia si aggiorna quando torna in primo piano e ogni 20 secondi mentre è visibile e online. Il manifest permette l’apertura standalone dai browser compatibili; non introduce salvataggi offline o un’app nativa.

## Commissioning: feedback Tony

Il piano e la lettura delle fonti sono in [Piano di sviluppo](docs/tony-development-plan.md).
La gestione dei nuovi messaggi, delle attività e delle bozze per Marco è descritta
in [Assistente operativo Tony](docs/tony-feedback/README.md), con
[registro aggiornabile](docs/tony-feedback/register.md). Nessun controllo periodico
di WhatsApp è attivo.

- `/overview`: dashboard per progetto con costruzione distinta dai tag, barre per fase, matrice categoria/località, Client Supplied e review I/R/AC/A. Le colonne completamente approvate si richiudono e i riepiloghi aprono i record filtrati.
- Navigazione: Overview, Programme, Assets e Tasks sono i percorsi principali; People, Time e Reports sono secondari. Su mobile le quattro destinazioni e More restano sempre raggiungibili senza scorrimento orizzontale.
- Primo utilizzo: Overview spiega il percorso; Assets e Programme vuoti mostrano la prima azione, senza filtri o grafici inutili. Nel programma mobile la lista delle attività è la vista iniziale, con timeline a scelta.
- `/schedule`: Gantt compatto con albero asset per categoria/fase/piano/area, date e durata lavorativa, predecessori Finish-to-Start e lag. Anteprima degli impatti, salvataggio versionato, baseline protetta e aggiornamento delle scadenze task collegate. Calendario lunedì–venerdì senza festività; nessun calcolo critical path o altro tipo di legame.
- `/commissioning`: tabella asset ricercabile, Client Supplied esplicito, gerarchia/metadati, livelli applicabili e collegamenti attività. Import asset CSV o registro JSON con anteprima, export CSV/JSON e storico progetto con ultimi tre eventi/dettaglio paginato. **Create missing tag activities** genera task non assegnati, uno per asset/livello; non duplica quelli già esistenti. Oltre 1.000 nuovi task, ripetere il comando per i successivi.
- Team: ricerca persona/azienda, filtri ruolo, tipo e stato lavoro, schede/lista e dettaglio dei record assegnati.
- `/reports`: tag, riepilogo per tipo di attrezzatura, andamento, programma, issue/task, documentazione O&M/formazione/garanzie/sign-off e conformità. CSV di tutti i risultati filtrati; stampa della pagina visualizzata, fino a 50 righe.
- `/admin`: il ruolo `admin` configura L1/L2/L2A/L2B/L3/L4/L5/L6 e P1–P5 per progetto e abilita i moduli per persona. **Task-only profile** mantiene task e impostazioni. Nella demo è disponibile **Project Administrator**; nessun account amministratore reale viene creato automaticamente. Membership e ruolo limitano sempre l'accesso ai dati.
- Asset → tag → test sheet: scegliere i tag richiesti nell'asset, aprire il singolo record e registrarvi risultato, note e documenti. La scheda è il task del tag; eventuali PDF/procedure cliente vanno allegati, non vengono inventati.
- Dettaglio task: collegamenti asset/P6, livello/tag, rischio, tipo documento e conteggi di conformità; registrazione separata di esito e avanzamento. Passare un test non approva automaticamente il tag; un esito fallito/retest impedisce la chiusura finché non viene risolto.

Le review esplicite dei tag contano come approvate solo in A; AC resta distinto.
I tag precedenti senza review mantengono il conteggio da workflow completato,
esposto come legacy. Le regole specifiche degli approvatori restano da confermare;
si applicano i permessi di gestione già esistenti. Lo storico registra la
preparazione server di export/download, senza attestare la ricezione nel browser.
Il ciclo del 15 ottobre non aggiunge migrazioni; restano necessari i prerequisiti
database descritti sotto per installazioni non ancora aggiornate.

Applicare `npm run db:migrate` sul database di destinazione **prima** di distribuire questa versione. Le nuove migrazioni aggiungono P4/P5, metadati commissioning, configurazioni per progetto, moduli per utente e unicità dei tag asset/livello. Lo sviluppo e i test usano una demo isolata e PostgreSQL in memoria, non il DB reale.

### Conversione degli Excel

Il browser importa asset CSV o un registro JSON validato; esportare prima offre
un modello compatibile. XLSX non viene importato direttamente. Il convertitore
Python legge gli Excel forniti (richiede `openpyxl`) senza modificarli:

```sh
python3 scripts/extract-commissioning.py 'HGB1A SPC CX Schedule _WIP - WW44.xlsx' output/hgb1a-register.json
python3 scripts/extract-commissioning.py AMS16_Cx_Programme.xlsx output/ams16-register.json
```

Il file `.review.json` associato contiene anomalie e scelte da verificare e non va importato. Per assegnare esplicitamente un insieme iniziale di livelli a tutti gli asset aggiungere, ad esempio, `--levels L2A L2B L3`, dopo aver verificato l'applicabilità. Senza l'opzione i livelli sono vuoti: non vengono indovinati dai colori. Configurare i livelli in Admin e verificare le eccezioni per asset prima di generare i tag.

Il convertitore AMS16 usa le date delle colonne dichiarate P6. Le colonne miste Actual/Forecast non diventano consuntivi o approvazioni. Il collegamento livello → Activity ID va verificato nel registro asset; nomi generici nelle issue non vengono associati automaticamente. Asset e programmi HGB1A/AMS16 appartengono a progetti distinti e devono essere importati separatamente.

Formato minimo del registro (le date assenti nelle revisioni mantengono il valore già registrato):

```json
{
  "assets": [
    {
      "id": "PUMP-01",
      "name": "Primary pump",
      "equipmentType": "Pump",
      "location": "Plant room",
      "levels": ["L3"],
      "levelActivities": { "L3": "P6-1000" }
    }
  ],
  "schedule": [
    {
      "activityId": "P6-1000",
      "name": "Pump commissioning",
      "start": "2026-10-01",
      "finish": "2026-10-02"
    }
  ]
}
```

Le issue mantengono la pipeline `scripts/extract-issues.py` / `scripts/import-issues.ts`, che propone un riepilogo prima dell'opzione esplicita `--apply`. Il caricamento del registro asset/P6 non importa automaticamente le issue.

### Limiti del collegamento esterno

Questa versione importa esportazioni; non sincronizza direttamente P6, BIM360, ACC o CxAlloy. La conformità deriva dai conteggi registrati, non da una certificazione automatica. La documentazione usa task con evidenze e approvazione; non replica l'intero sistema di gestione documentale e template descritto nelle 190 pagine della guideline. Lo storico dei trend parte dalle date presenti nei record: nessun dato storico viene inventato. La disponibilità di una facility non viene dichiarata automaticamente sulla base di una percentuale.
