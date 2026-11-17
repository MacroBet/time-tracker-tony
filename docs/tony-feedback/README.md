# Riprendere FieldTrack con Tony

**Chiusura funzionale17nov2026:** [release e PDF finale](intake-20261116-functional-completion.md).
Main9b16754 pubblicato, VercelREADY/Production success e alias verificati;
372unitari/PGlite+21API e statici/build PASS. PDF18pagine/21dettagli con QA18/18.
Send/Edit confermato da Marco nella demo locale; viste autenticate e readiness
voce online controllate separatamente. Il solo test AI live non è stato eseguito:
rifiuto automatico su contesto OpenAI/costo, unica approvazione specifica già
pendente in regia, nessun retry o domanda duplicata. MonitorPAUSED, nessuna nuova
lettura WhatsApp o modifica dati business. I resoconti sottostanti sono storici.

**Aggiornamento16nov2026:** [mandato esecutivo e prove](intake-20261116-implementation.md).
PianoA1–A8 approvato per implementazione/test/commit locali; monitor unico
`agente-progetto-tony` **PAUSED**, condizione di stop verificata. Nessuna ulteriore
lettura WhatsApp o continuazione automatica. Consenso specifico successivo16nov
«Approvo push e deploy»: sei commit fino ad a7b486a pubblicati e verificati
Production READY/success e alias200. Il precedente rifiuto è superato solo per
questo pacchetto; accettazione voce reale ancora da collaudare.
I riferimenti ACTIVE del17ott sotto descrivono il mandato storico, superato.

Apri una **nuova chat nel progetto/cartella Mobile Time Tracking App** e scrivi:

> Riprendi Tony

Puoi essere più preciso: «Fammi lo stato», «Leggi i nuovi messaggi di Tony» oppure
«Continua l'implementazione di …». Una domanda resta una domanda; non avvia sviluppo
indiscriminato. Il contesto è nel repository: non serve riaprire una vecchia chat.

**Monitoraggio ristretto ripreso il17ott.** Marco ha chiesto direttamente nella
regia vocale di continuare a seguire Tony. Riattivato l’unico heartbeat
**Agente progetto Tony**, `agente-progetto-tony`, ogni dieci minuti nella stessa chat.
Solo nuovi testi/materiali pertinenti, audio esclusi, silenzio senza novità; nessun
nuovo sviluppo o invio cliente implicito. Marco autorizza soltanto il deploy Area/Phase
se Tony lo richiede, previa verifica del target e senza duplicare deploy già riusciti.
[Fonti e stato verificato](intake-20261017-send-monitor.md).

La pausa del16ott rimane una decisione storica superata soltanto per questo monitoraggio.
Nuove chat e altri incarichi restano manuali. Nessun altro scheduler, polling proprio
o processo di continuazione. Il computer e l’app devono essere disponibili per i
controlli locali: configurazione ACTIVE non prova ogni lettura futura. L’aggiornamento
dei dati dentro FieldTrack rimane distinto dal lavoro dell’assistente.

Il mandato manuale successivo del17ott autorizza anche la rilettura delle fonti
pertinenti e lo sviluppo delle richieste chiare. Nuovo tetto umano18ott:90% usato,
10% residuo; stop nuovi lotti85 e cinque punti per finalizzazione, checkpoint40/60/75/85.
Fonte nativa user01a14e88-d38b-73f1-99dd-1076fcb0f1ea, verificata nel controllo18ott.
Uso ordinario non consentito o quota esaurita impongono STOP; niente reset o crediti extra. Nessun
nuovo invio, DB remoto o AI live. Non amplia lo scheduler. [Stato serale e gap](intake-20261017-evening.md):
non dichiarare tutta la chat letta; l'export senza media esiste ma non è ancora leggibile.

## Ultimo batch mail analizzato20ott2026

[Analisi7allegati e matrice requisito→app](intake-20261020-mail-analysis.md):
MPX,2XLSX,2PDF,PPTX eXER letti localmente, con prove e sintesi privata navigabile.
Prima di sviluppare/importare usare questo confronto e lo stato corrente: nuovi
passi/signoff/NC e incompatibilità P6 non sono coperti dal catalogo manuale.
Il batch è analisi conclusa, non autorizzazione a importare, inviare o pubblicare.
`regia-status.json` contiene `latestMailBatch20Oct` con copertura e percorso lettore.

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
   Eseguire `git fetch origin` e confrontare HEAD con origin/main; fare
   `git pull --ff-only` solo su main, con checkout pulito e aggiornamento necessario.
   Se già allineati non serve pull. Preservare modifiche e divergenze senza reset,
   stash o sovrascritture automatiche; next-env.d.ts preesistente non va committato.
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
   Poi chiudere il turno: solo il monitor esistente può riprendere il perimetro ristretto;
   nuovi incarichi di sviluppo richiedono mandato manuale.

## Verifiche proporzionate

### Consegna visiva a Marco

Regola esplicita del16nov: alla chiusura delle richieste di Tony, raccogliere
schermate o dettagli leggibili per tutte le modifiche effettive e preparare un
PDF inglese essenziale ma completo, pronto per l'inoltro manuale di Marco.
Riutilizzare gli screenshot disponibili e acquisire solo i mancanti nella demo
locale sintetica dichiarata. Titoli e didascalie brevi devono spiegare il beneficio;
non sostituire i risultati con immagini di sole toolbar o con dati cliente privati.

Applicare la skill PDF, marcare l'operazione, renderizzare e ispezionare tutte le
pagine. Finale sotto `output/pdf/`, originali e manifest pagina→modifica→screenshot
privati fuoriGit. Separare build demo e verifiche effettive in produzione; voce
reale o funzioni condizionali non collaudate devono restare esplicite. Il PDF non
autorizza nuove modifiche, deploy, chiamate pagate, credenziali o invii a Tony.
[Prima applicazione e copertura](intake-20261116-visual-guide.md).

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
