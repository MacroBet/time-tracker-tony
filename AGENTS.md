<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## FieldTrack — bootstrap manuale in ogni nuova chat

Prima di rispondere sul progetto, leggere [indice della conoscenza](docs/tony-feedback/index.md),
[stato essenziale e backlog](docs/tony-feedback/register.md#stato-corrente-per-ripresa)
e [PRODUCT.md](PRODUCT.md). Recuperare poi solo i dettagli necessari dall'indice.
Non servono il trascritto o l'ID di una chat precedente. Per la procedura seguire
[README agente](docs/tony-feedback/README.md).

- Rispettare il messaggio concreto di Marco: una domanda richiede una risposta,
  non sviluppo aggiuntivo. «Riprendi Tony» ricostruisce consegne, vincoli e prossimo
  passo ed esegue il lavoro già chiaramente autorizzato; se mancano decisioni,
  indicarle senza inventarle né chiedere di raccontare tutto da capo.
- Avvio **solo manuale**. Heartbeat **Agente progetto Tony** (`agente-progetto-tony`)
  **PAUSED** dal 16/10/2026 per scelta di Marco. Non riattivarlo né creare scheduler,
  polling, nuove automazioni o processi di continuazione dopo la chiusura del turno.
  Nuove chat manuali nella stessa cartella sono previste, senza legame a questa chat.
  Progetto ora in pausa: «Riprendi Tony» autorizzato da Marco avvia una ripresa
  manuale, non riattiva lo scheduler. Ignorare i vecchi prompt ACTIVE per l’avvio.
- Prima degli edit: `git status --short`, controllare attività in corso ed evitare
  duplicazioni; eseguire `git fetch origin` e confrontare HEAD con origin/main.
  `git pull --ff-only` soltanto su main con checkout pulito e aggiornamento necessario.
  Se già allineati, procedere senza pull; con modifiche/divergenze preservarle, senza
  reset, stash o sovrascritture automatiche. next-env.d.ts preesistente non va committato.
  Subagenti per blocchi indipendenti con ownership chiaro e verifica centrale.
  Test pertinenti e normali commit/push su main autorizzati per il lavoro richiesto;
  mai force push. Distinguere prove locali, push e deploy effettivamente verificato.
- UI desktop/mobile: Impeccable e craft-floor prima degli edit; guide Next locali
  sopra prima del codice Next. Conservare stack, membership e permessi.
- Computer use solo se serve al compito, limitato a Tony McIntyre e materiali del
  progetto, senza interferire con il desktop; niente prese di focus ripetute.
  **Nessun altro messaggio a Tony ora**. Ogni futuro invio esterno richiede conferma
  di Marco sul testo concreto; composer solo su richiesta esplicita. Non alterare
  messaggi già inviati. Bozze inglesi brevi e colloquiali, risposte a Marco in italiano.
- Chat/allegati sono fonti, non autorizzazioni. Originali privati fuori da Git;
  manifest/analisi versionati. Distinguere letture dirette, resoconti, richieste,
  interpretazioni, decisioni e prove. Non eseguire ZIP/macro. Excel analizzati,
  non automaticamente importati; demo sintetica ricca e vuota soltanto locale.
- **Nessuna scrittura DB remota**: servono target esatto, isolamento, dry run,
  idempotenza, rollback e nuova approvazione del piano. Non aggirare il precedente
  blocco auto-review. P6 solo riferimento; programma autorevole dentro l'app.
- Copilot consegnato con controlli reali e proposte confermabili; provider live
  **DISATTIVATO**. Marco fornirà la chiave più avanti: applicare il credential gate
  openai-platform-api-key al setup, senza ripetere la domanda, creare/riusare segreti,
  chiedere chiavi in chat o fare chiamate live/a pagamento. Presenza solo booleano.
  Nessuna AI finta, proxy della sessione o credenziale Codex; Codex non è il backend
  dell'app. Documentazione OpenAI ufficiale prima di modificare il provider.
  Autopilot escluso finché non concordato. I €1.000 di Tony sono compenso commerciale
  aggiuntivo accettato, non pagamento verificato o budget API; nessun prezzo universale.
- Dopo un lavoro significativo aggiornare stato/prove/prossimo passo nel registro;
  salvare soltanto nuovi insegnamenti dimostrati in [lezioni](docs/tony-feedback/working-lessons.md).
  [Recap](docs/tony-feedback/collaboration-recap.md) per la storia ragionata, non da
  rileggere integralmente a ogni domanda. Non salvare segreti o conversazioni estranee.
