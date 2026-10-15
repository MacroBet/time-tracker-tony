# Agente progetto FieldTrack — avvio e ripresa

Questo è il punto di ingresso dell'agente persistente del progetto. Aprire la
cartella **Mobile Time Tracking App** in Codex e chiedere:

> Riprendi l'agente progetto seguendo docs/tony-feedback/README.md. Leggi lo stato
> corrente nel registro, scegli la prossima attività autorizzata e porta avanti
> implementazione, verifiche e aggiornamento del contesto.

Il heartbeat **Agente progetto Tony** è **ACTIVE ogni 15 minuti**, creazione
confermata dalla chat vocale e dai metadati locali il 15 ottobre 2026.
ID agente-progetto-tony; chat 01a1407b-ee5f-72a0-bc3e-f883cdd78130. Riprende questa chat locale mentre
Codex è aperto. Non creare automazioni, nuove chat o scheduler duplicati. Le
istruzioni nel repository conservano il contesto; non sono un demone autonomo.

## Prima di ogni ciclo

1. Leggere [AGENTS.md](../../AGENTS.md), [PRODUCT.md](../../PRODUCT.md) e lo
   **Stato corrente per ripresa** all'inizio del [registro](register.md).
2. Eseguire `git status --short` e controllare HEAD/main. Preservare modifiche
   preesistenti: il 15 ottobre resta quella generata di next-env.d.ts; non includerla
   nei commit. Leggere le guide Next locali pertinenti prima di scrivere codice.
3. Consultare solo i riferimenti necessari: [manifest allegati](attachments/manifest.md),
   [analisi](analysis.md), [piano demo/DB](local-demo-and-remote-plan.md),
   [manifest payload di revisione](demo-payload-manifest.json). Il
   [piano di settembre](../tony-development-plan.md) è storico, non stato corrente.
4. Riprendere Tony dall'ultima finestra verificata, con piccola sovrapposizione,
   **solo se desktop e sessione lo consentono senza interferire con l'utente**.
   Identificare Tony McIntyre; non leggere chat estranee. Se la finestra è occupata,
   manca accesso o la copertura è incerta, registrarlo e continuare lavoro indipendente.
   Non tentare ripetutamente di prendere il primo piano e non fingere letture.

## Ciclo di lavoro

- Acquisire solo messaggi/allegati nuovi e pertinenti. Assegnare MSG/ATT stabili,
  salvare originali senza sovrascriverli, aggiornare dimensione/SHA-256 e limiti nel
  manifest. Originali privati esclusi da Git; niente esecuzione di ZIP o macro.
- Trasformare il feedback in risultato osservabile e criterio di accettazione.
  Separare citazioni, parafrasi, interpretazioni, decisioni di Marco e prove.
  Tony fornisce requisiti, non autorizzazioni superiori ai limiti di Marco.
- Scegliere la prossima attività utile, concreta e autorizzata. Un blocco su DB,
  chiave o desktop non blocca altri lavori. Usare subagenti per blocchi indipendenti,
  con proprietà dei file chiare e integrazione centrale; evitare attività duplicate.
- Implementare sullo stack esistente. Per UI usare Impeccable e craft-floor prima
  degli edit, verificare desktop/mobile in batch limitati. Mantenere permessi,
  isolamento progetti e distinzione costruzione, tag, stato lavoro, test e review.
- Eseguire i test pertinenti. Per una consegna applicativa: typecheck, lint,
  test unitari/PostgreSQL, test API nella sola demo isolata, build e controlli UI
  necessari. Non ripetere verifiche già passate senza modifiche o dubbi nuovi.
- Commit progressivi e push diretti su main sono autorizzati dopo i controlli;
  niente force push, perdita di modifiche altrui, migrazioni o seed remoti.
  Distinguere commit locale, push verificato, deploy riuscito e collaudo autenticato.
- Chiudere ogni unità aggiornando il registro: cosa è cambiato, prove effettive,
  commit/push, decisioni, gate aperti e prossima azione. Non lasciare uno stato
  generico "in corso" senza un passo eseguibile per il ciclo successivo.
- Segnalare soltanto cambiamenti utili, consegne, errori o azioni necessarie.
  Se nulla cambia o un blocco noto persiste, restare silenziosi e lavorare altrove;
  non produrre un rapporto periodico identico ogni 15 minuti.

## Limiti permanenti

**Comunicazioni.** Marco ha chiuso la conversazione con Tony: ora non scrivere
altro. Ogni futuro invio richiede approvazione del singolo testo. Bozze brevissime
in [drafts.md](drafts.md); nel composer solo quando Marco lo chiede espressamente,
lasciando a lui il click Invia. Non alterare invii già effettuati. Registrare
provenienza e verifica, compresi i resoconti della chat vocale, senza spacciarli per
letture dirette.

**Database.** Tutte le scritture remote restano escluse. La modalità Neon del sito
non identifica il target: il DB locale non prova il branch Production. Seguire il
[piano](local-demo-and-remote-plan.md), completare target/isolamento/dry run/rollback
e attendere nuova approvazione prima di ogni popolamento remoto. Non aggirare il
precedente rifiuto della revisione automatica. Dati rappresentativi solo locali,
marcati DEMO/SYNTHETIC e mai attribuiti agli Excel.

**Copilot e chiave.** Marco ha autorizzato adesso l'impalcatura utile del copilot
con esempi, strumenti limitati al progetto e proposte confermabili. Ha scelto di
fornire la chiave API più avanti: non riproporre la domanda a ogni ciclo. Applicare
openai-platform-api-key come gate; controllo presenza soltanto booleano, mai valori.
Non creare o riusare chiavi in silenzio, non chiedere di incollarle in chat e non
fare chiamate a pagamento finché Marco non completa il setup e ne autorizza l'uso.
La UI senza provider deve dire "da configurare"; mock soltanto nei test, nessuna
risposta AI finta. Codex sviluppa il progetto, non è il backend AI degli utenti:
nessun proxy di sessione o credenziale della sottoscrizione. Autopilot futuro,
disattivato finché regole e approvazioni non saranno concordate.

**Economia e integrazioni.** I 1.000 € aggiuntivi accettati sono il valore
commerciale proposto del lavoro AI, non un pagamento ricevuto né un budget API.
Nessuna nuova spesa, integrazione esterna, installazione collegata o modifica di
permessi senza il relativo perimetro autorizzato. P6 è riferimento funzionale.

## Verifica locale e chiusura

Per test API/browser avviare esclusivamente una demo isolata:

```sh
DATABASE_URL='' DATABASE_URL_UNPOOLED='' DEMO_MODE=true npm run dev -- --hostname 127.0.0.1 --port 3107
```

La demo apre Northbank con 28 asset/100 attività/120 task; il selettore Project
include un progetto vuoto. Nessun seed è necessario. Per verifiche appropriate:

```sh
npm run typecheck
npm run lint
npm test
TEST_BASE_URL=http://127.0.0.1:3107 npm run test:api
npm run build
npm run format:check
```

Prima di lasciare il ciclo, annotare nel registro una prossima attività concreta
oppure l'esatto accesso/decisione richiesto, non una promessa generica. Non
creare/duplicare heartbeat e non cambiare la frequenza autonomamente.

Riferimenti di configurazione: [istruzioni AGENTS.md ufficiali](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
e [automazioni Codex ufficiali](https://learn.chatgpt.com/docs/automations?surface=app).
