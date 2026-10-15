# Registro operativo — Tony

Ultimo aggiornamento: 15 ottobre 2026. Lettura diretta fino alle **19:20**;
aggiornamenti riferiti dalla chat vocale fino alle **20:16**.
Le ore sono quelle visualizzate da WhatsApp; il fuso della fonte non è verificato.

## Copertura e punto di ripresa

- Chat Tony McIntyre identificata nella sessione WhatsApp desktop esistente.
  Letti i messaggi di progetto del 13–15 ottobre fino alle 19:20 del 15 ottobre;
  consultato anche il contesto login del 12 ottobre. Lo storico precedente non è
  stato riletto integralmente. Contenuti estranei al progetto esclusi dal registro.
- Salvati 13 allegati: dimensioni, SHA-256 e limiti di analisi nel
  [manifest](attachments/manifest.md). Analisi dello ZIP in [analysis.md](analysis.md).
- Contesto già letto nel repository: `AGENTS.md`, `README.md`,
  `docs/tony-development-plan.md`, `docs/architecture.md`, `docs/use-cases.md`,
  `docs/import-analysis.md`; ispezione iniziale di `Overview.tsx` e
  `CommissioningReport.tsx`.
- Stato locale iniziale: ramo corrente, HEAD `fabd1ba`; modifica preesistente a
  `next-env.d.ts` (riferimenti generati da `.next/types` a `.next/dev/types`).
  Preservata. Nessun segreto esposto e nessuna operazione sul database remoto effettuata.
- Monitoraggio periodico: non attivo; frequenza non concordata.

## Contesto storico, da non confondere con nuovi feedback

Il piano di settembre descrive dashboard commissioning, registro asset/P6,
baseline/forecast, livelli configurabili, workflow e report. Il codice locale
contiene già grafici di riepilogo e report filtrabili. Questo non dimostra che il
deploy visto da Tony contenga lo stesso codice o gli stessi dati. I riferimenti
storici agli Excel non attestano la disponibilità locale degli originali oggi.

## Fonti della nuova acquisizione

Tutti i messaggi sono di Tony salvo indicazione. Le descrizioni sono parafrasi;
le virgolette riportano citazioni brevi. Riferimenti stabili per le prossime sessioni.

| ID                     | Data e ora          | Richiesta o contesto verificato                                                                                                                        | Allegato    |
| ---------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| MSG-20261013-01        | 13/10 11:09         | Team e riferimento colori: «COLOURS CAN BE THIS»                                                                                                       | ATT-001/002 |
| MSG-20261013-02        | 13/10 11:18 e 13:05 | Link Primavera P6 API, dice che si può automatizzare per progetto; link non aperto                                                                     | —           |
| MSG-20261013-03        | 13/10 11:26–11:27   | Numeri più vicini, colonne come screenshot; propone cerchi e stella per critical path con formulazione interrogativa                                   | ATT-003/004 |
| MSG-20261013-04        | 13/10 14:04         | Completamento costruzione separato dai tag; riepiloghi Issued/Rejected/Approved with comments/Approved, colonne I/R/C/A; click apre lista e stato task | —           |
| MSG-20261014-01        | 14/10 13:30–13:31   | Schema da aggiungere a commissioning dashboard; tag completion e sezione separata per Client Supplied Assets                                           | ATT-005     |
| MSG-20261014-02        | 14/10 14:47–14:48   | Foglio Status come riferimento per tag progress con più colonne; colonna al 100% si restringe e si riapre al click; cerchi dashboard aprono dettaglio  | ATT-006     |
| MSG-20261014-03        | 14/10 15:29         | Invia ADD PROJECT.xlsx                                                                                                                                 | ATT-007     |
| MSG-20261015-01        | 15/10 15:19–15:20   | Screenshot e primo ZIP, realizzati tramite AI; non sa come provarlo                                                                                    | ATT-008/009 |
| MSG-20261015-02        | 15/10 17:34, Marco  | Dice che esaminerà il risultato per capire come usarlo; messaggio già presente, non inviato dall'assistente                                            | —           |
| MSG-20261015-03        | 15/10 18:32         | «I WILL PLAY A LITTLE MORE»                                                                                                                            | —           |
| MSG-20261015-04        | 15/10 18:56         | Invia lo ZIP più recente cx-planner01-project-configuration.zip                                                                                        | ATT-010     |
| MSG-20261015-05        | 15/10 18:57         | Scheda asset tabellare, import/export; tracciare cambiamenti, ultimi tre in riepilogo, click su storico completo di edit/upload/download               | —           |
| MSG-20261015-06        | 15/10 18:57–18:59   | Dice che l'AI si era fermata, poi funziona di nuovo; non equivale a collaudo del software                                                              | —           |
| MSG-20261015-07        | 15/10 19:01         | Obiettivo principale: scheda Gantt come MS Project per governare il programma                                                                          | ATT-010     |
| MSG-20261015-1902      | 15/10 19:02         | Nuovo ZIP asset/audit/import-export; Tony non sa se sia valido                                                                                         | ATT-011     |
| MSG-20261015-1908      | 15/10 19:08         | Screenshot MS Project Timeline                                                                                                                         | ATT-012     |
| MSG-20261015-1910      | 15/10 19:10         | Programme overview per fasi, percentuali sample                                                                                                        | ATT-013     |
| MSG-20261015-1913/1914 | 15/10 19:13–19:14   | Stato verso completamento tag; sigle I/R/AC/A                                                                                                          | —           |
| MSG-20261015-1916      | 15/10 19:16         | Gestione asset/programmi semplice, tag richiesti via checkbox                                                                                          | —           |
| MSG-20261015-1918      | 15/10 19:18         | Gantt compatto, albero categoria/fase/piano/area                                                                                                       | —           |
| MSG-20261015-1920      | 15/10 19:20         | Preferisce la nostra versione; lo ZIP crea troppe pagine                                                                                               | —           |

## Attività

### Ciclo di implementazione autorizzato da Marco

**Rettifica più recente:** comunicazioni di nuovo solo in bozza, brevissime, mai
nel campo WhatsApp; invio soltanto dopo conferma esplicita di Marco sul messaggio
concreto. Non correggere messaggi già inviati. La precedente autorizzazione
all'invio autonomo è superata; subagenti e push main restano autorizzati.

Per questo ciclo Marco ha autorizzato subagenti e commit/push progressivi su main,
con controlli completi. La pianificazione autorevole vive nell'app; P6 e gli ZIP
sono riferimenti funzionali. Il backend Next.js/Neon esistente resta in uso.
L'autorizzazione ai push non autorizza ulteriori messaggi WhatsApp.

Il motore è pubblicato su main con `82445eb`; l'integrazione UI, asset, audit e
riepiloghi con `3929285`. Push verificati. Nessuna migrazione o scrittura sul DB
remoto; nessuna verifica di disponibilità del deploy completata.

Assunzione tecnica reversibile per il primo motore: calendario lunedì–venerdì,
nessuna festività implicita; durata inclusiva, dipendenza FS con successore dal
giorno lavorativo successivo e lag non negativo. Le date inserite sono vincoli
minimi; avanzare un predecessore ricalcola anche i successori. Il calendario è
esplicitato nell'interfaccia; non è una sincronizzazione P6.

| ID      | Attività                                    | Stato del ciclo          | Evidenza / limite                                                                                                                                                                  |
| ------- | ------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OPS-001 | Istruzioni, registro, bozze e archivio      | completata               | Originali privati ignorati da Git; nessuna automazione                                                                                                                             |
| OPS-002 | Acquisizione e analisi                      | completata               | 13 allegati; lettura messaggi fino alle 19:20, invio approvato 19:23                                                                                                               |
| OPS-003 | Confronto col codice                        | completata               | analysis.md conserva l'analisi iniziale e il delta implementato                                                                                                                    |
| CX-001  | Gantt persistente, date/durate e dipendenze | completata nel perimetro | /schedule, FS e lag, baseline, anteprima, ripple, controllo cicli e revisioni; calendario lun–ven senza festività; critical path e altri tipi di legame non implementati           |
| CX-002  | Registro asset e import/export              | completata nel perimetro | Tabella ricercabile/paginata, CSV asset e JSON registro, anteprima, ID stabili, metadati e gerarchia; import XLSX diretto non implementato                                         |
| CX-003  | Storico di progetto                         | completata               | Ultimi tre e storico paginato: revisioni, task/evidenze ed export reali; download registrato quando il server prepara il file, non come ricevuta browser                           |
| CX-004  | Costruzione e tag, I/R/AC/A                 | completata nel perimetro | Stato review separato da workflow/esiti, conteggi e drill-down; ruoli esistenti; transizioni/approvatori specifici ancora da definire                                              |
| CX-005  | Client Supplied                             | completata               | Campo true/false/non classificato; sezione e denominatori basati solo su flag esplicito                                                                                            |
| CX-006  | Configurazione fasi/progetto                | parziale                 | Tipo/località/MW e label/colore dei livelli canonici, checkbox di applicabilità asset; matrice disciplina × onsite/offsite e nuove sigle non implementate in attesa di chiarimento |
| CX-007  | Riepiloghi compatti e colonne richiudibili  | completata nel perimetro | Numeri, barre fasi, matrice categoria/località e colonne al 100% approvato richiudibili; nessuna criticità calcolata senza un motore critical path                                 |
| CX-008  | Team ricerca, filtri e viste                | completata nel perimetro | Persona/azienda, ruolo, lavoro/stato, lista/schede e dettaglio; nessun nuovo ruolo amministratore per team                                                                         |

## Decisioni e interpretazioni

- Ultima regola per WhatsApp: bozze brevissime esclusivamente in Codex, mai nel
  campo di composizione. Ogni invio richiede conferma esplicita sul testo preciso.
  Non alterare gli invii già effettuati.
- La precedente revoca della delega è stata superata dall'autorizzazione di Marco:
  quattro subagenti hanno lavorato su asset, audit, dashboard/team e intake Tony,
  con integrazione e controllo centrale.
- Tony ha precisato **I/R/AC/A** (19:14), chiesto checkbox asset/tag (19:16), Gantt
  compatto e albero categoria/fase/piano/area (19:18), preferito la nostra versione
  rispetto alle molte pagine dello ZIP (19:20). Fonte: [intake](intake-1912.md).
- Le review esplicite contano come approvate solo in A. Per i tag preesistenti
  senza review si mantiene la precedente approvazione da workflow completato,
  indicata come legacy. Nessuna conversione o backfill implicito. AC non è A;
  esito test, progresso programma e stato task restano separati.
- Lo storico viene conservato nel documento commissioning sul server e non
  distribuito nel bootstrap ai worker; consultazione ed export richiedono
  appartenenza al progetto e permessi management/modulo esistenti.

## Domande aperte e perimetro residuo

1. Chi può impostare AC/A, con quali transizioni e precondizioni? Tony non ha
   risposto alla domanda sui ruoli; non sono stati creati nuovi privilegi.
2. Qual è la classificazione Client Supplied reale? Il campo è pronto ma non
   vengono attribuiti flag in base al fornitore o al nome dell'asset.
3. Confermare W1/W2/W3, L21, i2/i3 e significato di L5 prima di nuove tassonomie.
   Matrice disciplina/onsite-offsite e amministratore per team restano da definire.
4. Se occorrono altri legami, festività o critical path, definirne le regole.
5. Verificare il deploy e poi il collaudo di Tony sui dati autorizzati. Il push
   non dimostra che il sito abbia completato il rilascio.

## Esito delle sessioni

### Aggiornamento acquisizione e comunicazione

Letti ulteriori messaggi di Tony fino alle **19:10**: alle19:02 invia
cx-planner02-assets-audit-import-export-energisation.zip (ATT-011), precisando che
non sa se sia valido; alle19:08 screenshot MS Project Timeline (ATT-012), alle19:10
Programme overview (ATT-013), che definisce un bel riepilogo progetto. Tre nuovi
originali privati salvati: totale13. Agenti asset/audit ne hanno letto staticamente
le sezioni pertinenti; immagini viste dal root, senza importare dati demo.

**OUT-20261015-01, 19:12, invio verificato UI:** prima della revoca, inviato un
aggiornamento: conferma lettura ZIP/screenshot, Gantt operativo come priorità,
asset/import-export/storico in sviluppo, uso di dati reali; domanda su separazione
I/R/C/A dal progresso/test e su chi approva tag. Non dichiarava rilascio o test
completati. Testo integrale conservato in WhatsApp; nessuna modifica/cancellazione.
Marco ha poi chiesto messaggi brevissimi e infine revocato l'invio autonomo.
Intake successivo delegato in sola lettura, senza permesso di composizione/invio.

### Invio singolo approvato e punto di ripresa

**OUT-20261015-02, 19:23:** testo esatto approvato da Marco e inviato una volta:
“Got it Tony, keeping our version, with a compact Gantt and simple tag setup.”
Bolla e una spunta verificate; composizione vuota. Consegna/lettura non verificate.
Autorizzazione esaurita. Dettagli in [intake-1912.md](intake-1912.md).
Riprendere dopo le 19:23 con sovrapposizione ai messaggi delle 19:20.

### 15 ottobre 2026 — verifica dell'implementazione

- 51 test unitari/PostgreSQL PGlite superati; nessun contatto con Neon.
- 7 test API superati contro demo locale isolata: persist/preview, ripple task,
  stale revision, cicli/link mancanti, permessi e isolamento progetto, review,
  storico/export e flussi preesistenti. I test API vengono eseguiti in sequenza.
- Typecheck, ESLint, Prettier, diff check e build di produzione superati.
- Browser: viste desktop 1440 e mobile 390 per Gantt, dashboard, asset e team;
  creazione/anteprima/salvataggio/ricaricamento di un'attività demo verificati.
  Revisione finale: campi bloccati durante il calcolo, ID duplicati rifiutati
  nell'editor nuovo e baseline parzialmente fuori finestra correttamente ritagliata.
- Screenshot locali in output/playwright, esclusi da Git. Dati di test solo demo,
  reset al riavvio; nessun contenuto degli ZIP eseguito e nessuna migrazione remota.
- Modifica preesistente next-env.d.ts preservata. Nessun monitoraggio periodico.

### Verifica deploy successiva ai test locali

L’API pubblica GitHub/Vercel segnala **success / Deployment has completed** per
il commit applicativo `3929285` (Production, 17:41 UTC) e per `084c272`
(Production, 17:44 UTC). Il repository dichiara come homepage
https://time-tracker-tony.vercel.app. Il deployment specifico di `3929285`
è https://time-tracker-tony-roaorrlpw-macrobets-projects.vercel.app;
il suo percorso /schedule richiede autenticazione Vercel. La riuscita del deploy
è verificata. Il dominio principale risponde HTTP 200 a /schedule, senza
redirect a Vercel; il collaudo autenticato sui dati reali non è stato effettuato.

Marco ha chiesto un giro in Chrome visibile. È stata aperta una tab demo locale
http://127.0.0.1:3107/schedule; l’ultimo stato del subagente era Loading your
workspace, quindi non viene attestato il Gantt visibile o il foreground.
Il controllo UI è poi passato al subagente della chat vocale, evitando
navigazioni concorrenti. Nessun ulteriore messaggio a Tony autorizzato o inviato.

### Seconda fase — UX e demo locale

Marco ha richiesto percorsi comprensibili senza manuale, navigazione gerarchica,
stati vuoti utili e interfaccia mobile progettata. Autorizzati subagenti, test e
push UX; **esclusa qualsiasi scrittura su database remoto**. La precedente
revisione automatica ha rifiutato la possibilità di scrittura Production senza
target/isolamento/rollback verificati. Il [piano separato](local-demo-and-remote-plan.md)
prepara quei controlli e non viene eseguito.

**MSG-20261015-1953**, fonte riferita dalla chat vocale: il subagente ha letto un
nuovo messaggio di Tony delle 19:53; nell’asset setup i tag vanno definiti secondo
la tabella e ciascuno deve avere stato e scheda di test collegata. Questa è una
parafrasi del resoconto ricevuto, non una nuova lettura diretta del root; nessun
nuovo allegato segnalato. Le sigle/mappature ambigue rimangono da chiarire.

Risposta implementativa: dalla scelta dei tag richiesti per asset si apre la
scheda task del singolo tag, con stato del lavoro, review, risultato test, note ed
evidenze distinti. I task esistenti sono mantenuti; nessuna checklist cliente o
modello di test esterno viene inventato. Generazione dei tag mancanti esplicita
per l’intero progetto, senza duplicare gli obblighi già creati.

La demo locale opt-in aggiunge p-demo-rich e p-demo-empty. Nessun Excel di Tony
importato e nessun seed remoto eseguito. Le quantità e le regole sono nel piano.
La gestione dei feedback resta in questo registro e nelle istruzioni persistenti;
nessuna automazione/frequenza futura concordata e nessun invio WhatsApp autonomo.

### Comunicazione riferita dalla chat vocale — 20:07

**OUT-20261015-03**: la chat vocale riferisce invio del solo testo approvato
“Tony, the main part is done. I’m making a few improvements now.” alle 20:07,
con bolla e successivamente doppia spunta verificate dal suo subagente.
Questo root non ha effettuato l’invio né una nuova lettura WhatsApp.

Marco ora consente la preparazione nel composer **quando la chiede espressamente**,
lasciando a lui il click Invia. Non autorizza invii autonomi o compilazione generica.
Al controllo riferito, la bozza seguente era nel composer e **non inviata**:
“The next big thing is an AI assistant inside the app, helping you manage the
project, spot delays and update tasks just by chatting.” Il precedente secondo
messaggio rifiutato era stato sostituito; non risulta inviato. Terza bozza sul
compenso gestita dalla chat vocale, non da questo root.

La ricerca storica riferita ha trovato proposta time-tracker del 4 settembre a
1.500 €, tono colloquiale e accettazione di Tony. Il presunto primo versamento da
1.000 € ricordato da Marco non è stato verificato e non viene registrato come
pagamento avvenuto. Una bozza su un futuro assistente AI non implica funzionalità
consegnata o autorizzazione a implementare ora API/chat AI.

### Consegna della seconda fase

Fixture locale: commit `865315a`. UX: commit `aa8e67e`, navigazione principale Overview/Programme/
Assets/Tasks, More mobile, guida al primo utilizzo, liste mobile per programma e
asset, impostazioni/import/storico progressivi, risultato test separato dalla
review. La voce Online indica la rete del browser, non lo stato del database.

Verifiche effettive:

- 56 test unitari/PostgreSQL PGlite superati; cinque verificano fixture, riferimenti,
  grafo, idempotenza e separazione review/esecuzione. Test fixture ripetuti dopo
  l’allineamento dei progressi e dei nomi, con esito positivo.
- Tutti i 7 test API superati su 127.0.0.1:3107 in modalità demo, con DATABASE_URL
  e DATABASE_URL_UNPOOLED vuote. Assert multi-progetto aggiornato alle membership,
  mantenendo i controlli 403/404. Nessun test API puntato alla produzione.
- Typecheck, ESLint, Prettier, diff check e produzione build superati. Detector
  Impeccable finale sui sette componenti modificati: nessun finding.
- Un batch desktop/mobile di stati vuoti e popolati, correzioni raccolte e una
  conferma. Nessun overflow pagina a 390 o 1440 px. Menu More, import via hash,
  primo programma salvato e primo asset/tag/scheda test provati nella sola demo.
- ID asset duplicato rifiutato; controlli bloccati durante l’anteprima; nuovo editor
  non chiuso dalla risposta precedente; scheda tag portata in vista e ancore sotto
  l’intestazione correttamente distanziate. Navigazione worker preservata.

I dati creati durante le prove sono stati azzerati riavviando soltanto il server
demo locale. Gli screenshot in output/playwright restano esclusi da Git.
La modifica next-env.d.ts preesistente è preservata. Nessun dato remoto importato,
nessuna credenziale letta per il piano e nessun WhatsApp mosso da questo root.

Prossimo punto di ripresa: feedback riferito delle 19:53 e comunicazione approvata
riferita delle 20:07; eventuali messaggi successivi non sono coperti. L’eventuale
popolamento remoto rimane subordinato a target esatto, isolamento e rollback
verificati e approvazione esplicita del piano. Non attivare API/chat AI sulla base
delle sole bozze commerciali.

### Aggiornamento comunicazioni riferito — 20:13–20:16

Fonte: verifica riferita dalla chat vocale; nessuna nuova azione WhatsApp del root.

- **OUT-20261015-04, 20:13:** Marco ha inviato manualmente “The next big thing is
  an AI assistant inside the app, helping you manage the project, spot delays
  and update tasks just by chatting.” Doppia spunta blu riferita come verificata.
  La bozza annotata prima come non inviata risulta quindi superata dall’invio.
- **MSG-20261015-2014, 20:14:** Tony conferma che è ciò che vuole, AI o casella
  testo, e aggiunge l’utilizzo durante una riunione. Parafrasi del resoconto.
- **OUT-20261015-05, 20:16:** Marco ha inviato manualmente “If you want to add AI,
  I’ll need to work on that a bit more. Shall we say another €1,000 for that?”
- **MSG-20261015-2016, 20:16:** risposta di Tony “No probs”. Registrata come
  assenso alla proposta economica, **non pagamento ricevuto** e **non perimetro
  tecnico definitivamente concordato**.

Al controllo riferito esiste una nuova bozza copilot → autopilot nel composer,
non inviata. Nessun permesso di inviarla per l’assistente. Ogni testo resta sotto
controllo di Marco; non muovere WhatsApp o alterare le bozze.

Backlog da definire in una fase separata: chat sui dati autorizzati del progetto,
aiuto su gestione/ritardi/task e uso in riunione. Prima chiarire comportamento,
accessi e modifiche proposte; approccio copilot con controllo, prima di eventuale
automazione. Nessuna integrazione AI/API avviata, nessun segreto creato e nessuna
scrittura remota autorizzata da questo scambio. Punto di ripresa riferito: 20:16.
