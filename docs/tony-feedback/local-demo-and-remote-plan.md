# Demo locale e proposta di popolamento remoto

Stato: **solo fixture locale implementata; nessun popolamento di database remoto autorizzato o eseguito**.
Questo piano non è un comando di importazione. Prima di proporre un'applicazione
servono target verificato, isolamento e approvazione esplicita di Marco sul piano completo.

## Cosa è disponibile ora

La demo locale contiene due progetti aggiuntivi, con ID stabili:

| Progetto                       | ID           | Contenuto sintetico                                                                                                                               |
| ------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEMO · Northbank commissioning | p-demo-rich  | 28 asset (24 apparecchiature, 4 gruppi), 100 attività programma, 120 task (96 tag, 12 costruzione, 8 issue, 4 documentazione), eventi e revisioni |
| DEMO · Start a project         | p-demo-empty | Configurazione pronta, nessun asset/programma/task; serve a provare il primo utilizzo                                                             |

Sono presenti gerarchie, due fasi, tre piani, quattro aree, Client Supplied
true/false/non classificato, dipendenze FS con lag, baseline e forecast diversi.
Le schede tag distinguono stato del lavoro, risultato test e I/R/AC/A; il dataset
include test superati ancora non approvati e AC distinto da A. Le percentuali del
programma descrivono esecuzione, senza derivarle dall'approvazione.

Tutto è inventato e marcato SYNTHETIC. Non deriva dagli Excel, dagli ZIP o dai
progetti reali di Tony. Le schede di test sono record task con risultato, note ed
evidenze; non sono moduli cliente o protocolli esterni importati.

La fixture è opt-in: `createDemoData(now, { showcase: true })`. Solo il repository
in modalità demo locale la attiva; le chiamate preesistenti e `scripts/seed.ts`
restano senza questi progetti. Applicarla due volte allo stesso stato non duplica
record e non cambia il progetto preesistente p1. Nessun nuovo endpoint di seed.

Per la verifica esclusivamente locale:

```sh
DATABASE_URL='' DATABASE_URL_UNPOOLED='' DEMO_MODE=true npm run dev -- --hostname 127.0.0.1 --port 3107
```

Accedere con il selettore demo. Il progetto popolato è selezionato inizialmente;
si può scegliere quello vuoto dal campo Project. Un riavvio del processo azzera
le modifiche della demo. Non eseguire seed o provisioning contro un DB remoto.

## Evidenza sul target remoto

- Sito verificato: https://time-tracker-tony.vercel.app.
- `/api/auth/session` ha dichiarato `mode: neon`; il controllo anonimo non prova
  da solo la riuscita di una query DB. `/api/bootstrap` senza sessione risponde 401.
- Nella lettura autenticata riferita dalla chat vocale, Marco vedeva FieldTrack Test,
  progetto **AMS16 · Test**, zero asset/programma e 329 eventi. Non è un inventario
  completo del database e non identifica il branch Neon.
- Nessuna credenziale o connection string letta per questo piano. Project ID Neon,
  branch ID, nome database, ruolo SQL e corrispondenza con l'ambiente Vercel
  **non sono verificati**. Il progetto AMS16 · Test non è un target di popolamento.

## Target proposto e isolamento

Proposta da rivedere: creare un **branch Neon dedicato alla dimostrazione**,
collegato esclusivamente a un deployment preview separato. Nessuna modifica alle
variabili Production e nessuna importazione nel progetto AMS16 · Test.

Il futuro verbale di approvazione deve riportare questi valori esatti, ottenuti
in sola lettura dalle console/API autorizzate, senza copiare segreti:

| Identità da verificare                                  | Stato attuale                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Neon project ID, branch ID/nome, database, ruolo        | Non verificati: importazione bloccata                                                      |
| Origine del branch e assenza di dati cliente nella demo | Da decidere; preferire database vuoto con schema verificato                                |
| Vercel progetto/deployment preview e dominio            | Non creato né collegato                                                                    |
| Progetto applicativo demo dedicato                      | Nome proposto: DEMO · Northbank commissioning; ID remoto da riservare e verificare assente |
| Account autorizzati e relative membership               | Da mappare esplicitamente; gli ID u1–u6 locali non sono account reali                      |
| Responsabile, data di scadenza e approvazione del piano | Marco; da confermare dopo la verifica del target                                           |

Se il desiderio è mostrare la demo nel sito Production, occorre una proposta
separata con progetto dedicato, account e visibilità esatti e nuovo esame di
isolamento/rollback. Non utilizzare la proposta preview come autorizzazione
implicita alla scrittura in Production.

## Procedura proposta, non eseguita

1. Inventariare in sola lettura gli ambienti attuali e identificare i target
   proposti. Nessuna preview o branch viene creato in questa fase.
2. Preparare il confronto con lo schema/migrazioni richiesti, senza applicarli;
   preparare un manifest del payload
   con hash, conteggi, ID riservati e mappatura account. Nessuna password sintetica
   riusata per account reali e nessuna copia automatica degli utenti cliente.
3. Preparare una dry-run: schema, gerarchia e grafo validi, date coerenti, ID unici,
   collegamenti task/asset/programma nello stesso progetto, permessi e denominatori
   corretti. Verificare che gli ID demo non esistano già e che nessuna operazione
   aggiorni record esterni al manifest. Una ri-esecuzione del medesimo manifest già
   riconciliato termina senza duplicare dati; un ID occupato da contenuto diverso
   interrompe l’operazione e richiede una nuova revisione.
4. Presentare a Marco target completo, payload, diff atteso e rollback. Attendere
   approvazione esplicita prima di creare branch, configurare preview o scrivere dati.
5. Solo dopo approvazione, creare l’ambiente dimostrativo autorizzato e verificare
   i suoi ID e collegamenti effettivi: la preview deve puntare al branch dedicato,
   Production deve conservare il proprio collegamento. Confrontare anche lo schema
   effettivo con quello previsto e fermarsi in caso di differenze. Solo dopo questo controllo,
   usare una transazione per i record applicativi: inserimenti
   identificati, nessun upsert su record non posseduti dal manifest. Un conflitto
   inatteso annulla tutto. Riconciliare esattamente i conteggi e conservare il manifest.
6. Collaudare la preview con un account dedicato: login, letture, ripresa sessione,
   filtri e isolamento. Nessun test mutativo viene puntato a Production.

## Reversibilità e controlli

Prima dell'eventuale esecuzione, predisporre un punto di ripristino del branch
isolato e conservare il manifest completo. Per una transazione non conclusa,
ROLLBACK deve lasciare zero record aggiunti. Dopo il commit, il ripristino o
l'eliminazione del solo branch dimostrativo è la via preferita; richiede anch'esso
un'azione remota autorizzata e la verifica che nessun altro ambiente lo usi.

Un'eventuale rimozione selettiva deve lavorare solo sul progetto e sugli ID del
manifest, verificare prima e dopo i conteggi, rispettare le dipendenze fra evidenze,
eventi, task, membership e progetto e fermarsi se trova record estranei collegati.
Non cancellare account condivisi, non usare prefissi generici come unico criterio,
non svuotare tabelle e non ripristinare sopra dati di altri progetti.

La revisione automatica della richiesta precedente ha rifiutato la possibilità di
scrivere in produzione perché target, isolamento e rollback non erano verificati.
Il presente lavoro resta entro il perimetro sicuro: UX, fixture locale e piano;
nessun tentativo alternativo di scrittura remota.
