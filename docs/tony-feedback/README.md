# Riprendere FieldTrack con Tony

Apri una **nuova chat nel progetto/cartella Mobile Time Tracking App** e scrivi:

> Riprendi Tony

Puoi essere più preciso: «Fammi lo stato», «Leggi i nuovi messaggi di Tony» oppure
«Continua l'implementazione di …». Una domanda resta una domanda; non avvia sviluppo
indiscriminato. Il contesto è nel repository: non serve riaprire una vecchia chat.

**Solo avvio manuale.** Marco ha scelto il 16 ottobre 2026 di evitare consumo AI
periodico: heartbeat **Agente progetto Tony**, ID `agente-progetto-tony`, **PAUSED**.
Non riattivarlo o crearne altri senza richiesta. Nessun polling o continuazione
in background dopo il turno. L'aggiornamento periodico dei dati nell'app aperta
è una funzione diversa e non avvia l'assistente di sviluppo.

## Come viene recuperato il contesto

[AGENTS.md](../../AGENTS.md) è l'ingresso delle istruzioni di progetto. Indirizza
ogni nuova chat all'[indice](index.md), allo [stato essenziale](register.md#stato-corrente-per-ripresa)
e a [PRODUCT.md](../../PRODUCT.md) prima di rispondere sul progetto. L'indice rimanda
ai dettagli pertinenti: backlog, fonti, decisioni, allegati, recap e insegnamenti.
Non promette memoria perfetta o identica identità tra modelli: conserva conoscenza
verificabile e un metodo di ripresa. Nessuna skill personale o memoria globale è
necessaria per recuperare FieldTrack da questa cartella.

Il comportamento usa le [istruzioni AGENTS.md ufficiali](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
La nuova chat deve avere accesso a questa stessa cartella; una chat estranea non
riceve automaticamente il contesto Tony. Non è stata aperta una chat di prova:
la verifica di questa unità è documentale e tramite revisione indipendente.

## Procedura per l'assistente

1. Leggere il bootstrap essenziale; poi solo i riferimenti richiesti dalla domanda.
   Per «Riprendi Tony», ricostruire risultato corrente, backlog, vincoli e lavoro
   già autorizzato senza far rispiegare tutto a Marco.
2. Controllare `git status --short`, HEAD e attività in corso prima di modificare.
   La modifica preesistente next-env.d.ts va preservata e non committata.
   Coordinarsi senza duplicare; non creare nuove chat o scheduler per continuare.
3. Eseguire solo il compito richiesto o il prossimo lavoro chiaramente autorizzato.
   Se servono regole dei gruppi, accesso DB o setup chiave già segnalati, riportare
   il punto preciso; non trasformare un'ipotesi in decisione o ripetere domande risolte.
4. Computer use soltanto quando utile al compito e consentito dalla sessione,
   limitato a Tony/materiali di progetto e senza interferenze. Consultare prima
   la copertura corrente. Un rifiuto auto-review non va aggirato; niente tentativi
   ripetuti di focus/sblocco. Nessun messaggio o composer senza autorizzazione puntuale.
5. Per implementazione: guide Next locali, Impeccable/craft-floor se UI, stack e
   permessi esistenti, subagenti indipendenti e verifica centrale. Commit/push main
   normali autorizzati per il lavoro richiesto, mai force push. Nessun DB remoto,
   seed, provider live o spesa impliciti. I limiti correnti sono nel registro e AGENTS.
6. Alla chiusura di un risultato significativo aggiornare registro con fonti,
   prove, limiti, commit/push/deploy distinti e prossimo passo. Aggiornare recap e
   lezioni solo per novità sostanziali, senza copie divergenti o dump della chat.
   Poi fermarsi: la prossima esecuzione parte da una richiesta manuale di Marco.

## Verifiche proporzionate

Per documentazione/configurazione di avvio: link, coerenza delle istruzioni,
formato e revisione mirata; nessuna suite applicativa o nuovo deploy necessario.
Per cambi applicativi usare test pertinenti, typecheck/lint/build e UI quando
necessaria. Non ripetere test già passati senza modifiche o dubbi nuovi.

Test API/browser esclusivamente nella demo locale isolata, senza seed:

```sh
DATABASE_URL='' DATABASE_URL_UNPOOLED='' DEMO_MODE=true COPILOT_ENABLED=false OPENAI_API_KEY='' OPENAI_MODEL='' npm run dev -- --hostname 127.0.0.1 --port 3107
```

Northbank contiene esempi sintetici; il selettore include un progetto vuoto.
Per una consegna applicativa, secondo il cambiamento:

```sh
npm run typecheck
npm run lint
npm test
TEST_BASE_URL=http://127.0.0.1:3107 npm run test:api
npm run build
npm run format:check
```

Fonti private e screenshot restano esclusi da Git. Il repository conserva
manifest, analisi e conoscenza operativa; **non è un backup degli originali privati**.
Per trasferirli serve un archivio privato separato, senza pubblicarli nel repository.
