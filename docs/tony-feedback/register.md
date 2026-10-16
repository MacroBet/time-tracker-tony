# Registro operativo — Tony

Ultimo aggiornamento: 16 ottobre 2026. Lettura diretta fino alle **20:56 del
15 ottobre**, inclusi Excel asset e richieste successive. I precedenti
resoconti vocali restano distinti dalla nuova lettura diretta.
Le ore sono quelle visualizzate da WhatsApp; il fuso della fonte non è verificato.

## Stato corrente per ripresa

**Missione:** far avanzare FieldTrack con autonomia nel perimetro di Marco. Punto
operativo: [README agente](README.md). Heartbeat **Agente progetto Tony**, ACTIVE
ogni 15 minuti in questa chat locale; non creare duplicati. Nessun altro messaggio
a Tony adesso. Se desktop occupato/inaccessibile, registrare la copertura e
continuare il lavoro indipendente, senza prendere il primo piano ripetutamente.

**Consegnato:** Gantt persistente, asset CSV/JSON, storico, review I/R/AC/A,
Client Supplied e UX desktop/mobile. Protocollo persistente cc14c07 consegnato
prima del Copilot. **Copilot 0f80a4e su main remoto verificato:** controlli reali,
esempi, provider server disabilitato e proposte task con anteprima/conferma.
Ultimo ciclo: **76 test unitari/PostgreSQL, 9 API**, typecheck/lint/format/build
e UI desktop/mobile superati. **Deploy Copilot Vercel success** verificato il
15 ottobre alle 19:22 UTC (21:22 Europe/Rome), collaudo autenticato solo locale;
deploy UX 108042a già riuscito. Rileggere git per HEAD corrente. Modifica
next-env.d.ts preesistente preservata e non committata.

**DATA-002 consegnata:** preflight XLSX locale con provenienza e rapporto privato
non importabile. Sette test Python sintetici e riconciliazione su ATT-014 superati;
nessun nuovo collaudo applicativo, import, DB o provider. [Uso e prove](asset-preflight.md).

**Copertura Tony:** lettura diretta root fino 20:56 del 15 ottobre, verificata
il 16 ottobre nella chat già aperta con sovrapposizione da 20:14. Nessun messaggio
del 16 ottobre visibile in fondo alla chat in quel momento. **14 allegati** nel
manifest: lista di esempio acquisita come ATT-014 (20:41), 1.354 righe candidate,
nomi ripetuti e campi richiesti ancora assenti. [Analisi e mappatura](intake-20261016.md).
Marco ha richiesto una risposta e ribadito la conferma del testo prima dell'invio:
[bozza](drafts.md) successivamente inserita nel composer su richiesta esplicita
di Marco, testo completo verificato; nessun invio, click Invia lasciato a Marco.
Riprendere con sovrapposizione 20:41–20:56 quando desktop/sessione lo consentono.
Tony sarà via 10 giorni dalla prossima settimana, lavorando da remoto: resoconto,
non calendario o consegna concordati.

**Gate DB:** Production dichiara mode neon, ma endpoint/project/branch effettivi
non identificati. Solo host/database locali estratti; nessuna query SQL. Accessi
Vercel/Neon non collegati, browser lasciato all'utente. [Piano e intervento minimo](local-demo-and-remote-plan.md)
e [manifest payload](demo-payload-manifest.json) pronti per revisione; nessuna
scrittura remota, seed o creazione branch autorizzata in questa fase.

**Gate AI:** Marco ha scelto chiave fornita più avanti e autorizzato esplicitamente
l'impalcatura utile **ora**, prima della chiave, con esempi e proposte controllabili.
Discovery sicura: nessuna OPENAI_API_KEY nell'ambiente/.env.local; nessun valore
mostrato. Non riproporre la decisione a ogni ciclo, non creare/riusare segreti,
nessuna chiamata live/a pagamento. Copilot onesto "da configurare"; mock solo
nei test. Codex sviluppa, non è il backend dell'app. Autopilot futuro disattivato.
I 1.000 € sono proposta commerciale accettata, non pagamento o budget API.

| Priorità / ID                       | Stato                                  | Prossima unità concreta                                                                                             | Accettazione / gate                                                                               |
| ----------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| OPS-004 protocollo/heartbeat        | completata (cc14c07)                   | Consegnare e verificare link di README, AGENTS, registro; commit/push prima del copilot                             | Ripresa da documenti senza ricostruire chat; heartbeat esistente, nessun duplicato                |
| AI-001 copilot utile senza live API | completata (0f80a4e)                   | Controlli e ricerca su dati del progetto, provider configurabile server-side, UI con esempi; attendere setup AI-003 | Senza chiave/modello/abilitazione nessuna richiesta; scope e permessi verificati                  |
| AI-002 proposte controllabili       | completata (0f80a4e)                   | Titolo/descrizione/priorità con anteprima, motivo e conferma; nessuna estensione automatica del perimetro           | Token 10 minuti legato a sessione/utente/progetto/versioni, audit esistente e replay rifiutato    |
| CX-009 tag/gruppi/check sheet       | analisi aggiornata, regole da definire | ATT-014 acquisito; progettare gruppi nominati IST/fase/area/piano con membri espliciti e copertura schede           | Non propagare risultati/approvazioni; definire modifiche membri e stati condivisi                 |
| DATA-002 preflight Excel asset      | completata, solo locale                | Rapporto privato ripetibile e guida asset-preflight.md; attendere mapping espliciti prima di un import              | 1.354 righe riconciliate, duplicati preservati, sette test e protezione sovrascrittura verificati |
| CX-010 riferimenti asset esterni    | analisi pronta, mapping da chiarire    | Separare ID interno, cliente e programma; chiarire Schedule ID nella risposta proposta                              | Reimport stabile senza duplicati e senza rinominare ID già collegati a task                       |
| UX-002 chiarezza continua           | pronta                                 | Migliorare il prossimo percorso realmente provato, senza rifare UI appena verificata                                | Primo passo chiaro, mobile strutturale, permessi e dati preservati                                |
| DATA-001 dati rappresentativi       | locale completata / remoto in attesa   | Usare demo Northbank/empty per verifiche; identificare target da metadati quando accesso disponibile                | Mai popolare AMS16 Test o Production senza piano completo e nuova approvazione                    |
| AI-003 attivazione provider         | in attesa di Marco                     | Setup sicuro chiave e autorizzazione d'uso; non chiederla in chat                                                   | Nessuna spesa implicita; prima live call solo dopo completamento del gate                         |
| AI-004 autopilot                    | futuro                                 | Definire dashboard, regole, ambiti, audit e approvazioni                                                            | Nessuna attivazione autonoma o autorità desunta da messaggi Tony                                  |

Quando una voce è bloccata, scegliere la prossima pronta. Dopo ogni unità annotare
file/prove/commit e passo successivo qui, senza riscrivere lo storico sottostante.

## Copertura e punto di ripresa

- Chat Tony McIntyre identificata nella sessione WhatsApp desktop esistente.
  Letti i messaggi di progetto del 13–15 ottobre fino alle 19:20 del 15 ottobre;
  consultato anche il contesto login del 12 ottobre. Lo storico precedente non è
  stato riletto integralmente. Contenuti estranei al progetto esclusi dal registro.
- Salvati 14 allegati: dimensioni, SHA-256 e limiti di analisi nel
  [manifest](attachments/manifest.md). Analisi dello ZIP in [analysis.md](analysis.md).
- Contesto già letto nel repository: `AGENTS.md`, `README.md`,
  `docs/tony-development-plan.md`, `docs/architecture.md`, `docs/use-cases.md`,
  `docs/import-analysis.md`; ispezione iniziale di `Overview.tsx` e
  `CommissioningReport.tsx`.
- Stato locale iniziale: ramo corrente, HEAD `fabd1ba`; modifica preesistente a
  `next-env.d.ts` (riferimenti generati da `.next/types` a `.next/dev/types`).
  Preservata. Nessun segreto esposto e nessuna operazione sul database remoto effettuata.
- Heartbeat **Agente progetto Tony** ACTIVE ogni 15 minuti, creazione confermata dalla chat vocale; non duplicare. La lettura WhatsApp dipende da accesso e finestra disponibile.

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

**Regola corrente:** nessun altro messaggio a Tony ora. Per il futuro, bozze
brevissime in Codex; nel composer solo su richiesta esplicita e Invia a Marco.
Ogni eventuale invio richiede conferma sul testo concreto. Non correggere gli invii. La precedente autorizzazione
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

### 16 ottobre 2026 — DATA-002, preflight locale

Heartbeat coordinato con **Find login instructions**, che ha completato
acquisizione e analisi senza implementare DATA-002. Nessun accesso desktop o
WhatsApp ripetuto da questo ciclo; copertura aggiornata dalle evidenze di quella
chat, non da una nuova lettura del heartbeat. Nessun invio effettuato.

Intake già completato versionato separatamente in d4da66a, senza cambiare la
bozza o gli originali. Implementati `scripts/preflight-assets-xlsx.py`, sette
test sintetici Python e [guida](asset-preflight.md). Rapporto privato ignorato
`output/asset-preflight/att-014.review.json`: 1.354 candidate, 1.164 nomi distinti,
179 nomi ripetuti, 190 righe eccedenti, nessun duplicato esatto; nota A705 esclusa
e conservata. Provenienza, metadati originali, formule/cache separate e campi
mancanti conservati. FR e Design phase restano separati.

PASS: sette test, conteggi indipendenti riconciliati, hash sorgente invariato,
due report byte-identici, riconciliazione di tutte le 25.465 righe dopo l'header,
rifiuto di sovrascrittura, formato documenti e diff. Export Google Sheets senza
dimensioni gestito calcolando l'estensione in sola lettura. Nessuna macro,
formula o collegamento eseguito, nessun ID/livello/gruppo inventato.

Questa è una utility locale e non cambia l'app: suite Next/API/UI già passate non
ripetute, nessuna migrazione, DB remoto o live API. Prossimi passi: chiarire
Schedule ID e regole/identità dei gruppi prima di CX-010/CX-009; attivazione AI
ancora rinviata a Marco. Non usare il rapporto come payload di importazione.

### 16 ottobre 2026 — nuovi messaggi ed Excel asset

Marco ha chiesto elaborazione e risposta WhatsApp e ha ribadito la conferma
personale dell'invio. Lettura diretta della chat Tony già aperta, senza aprire
chat estranee, fino al messaggio 20:56 del 15 ottobre. Acquisiti i nuovi
MSG-20261015-2041/2054a/2054b/2056 e ATT-014. Dettagli e mappatura in
[intake-20261016.md](intake-20261016.md).

Originale privato salvato senza risalvarlo, 1.417.083 byte, SHA-256 verificato;
ignorato da Git. Lettura con Python bundled/openpyxl e confronto del codice
delegato in sola lettura, integrazione centrale. Quattro fogli, 1.354 righe
candidate e 1.164 nomi distinti; 179 nomi ripetuti, nessuna riga candidata
completamente identica. Escluse nota libera e righe vuote/template. Le cache
non dimostrano il ricalcolo; nessuna macro o collegamento esterno eseguiti.

Chiarite le differenze tra fonte e modello: ID interno separato dai riferimenti
cliente/programma, FR distinto da Design phase numerica, gruppi nominati distinti
dalla gerarchia parentAssetId. Nessuna deduplica per nome, livello dedotto o
propagazione di stato. Nuove unità DATA-002/CX-010 e CX-009 aggiornate.

Aggiornati PRODUCT, manifest, registro e bozza brevissima in drafts.md. Non
modificata l'app e non importati dati in FieldTrack. Nessuna query/scrittura DB
remota, chiamata AI o nuova spesa. Composer lasciato vuoto, nessun messaggio
inviato. La bozza non dichiara funzioni nuove implementate. next-env.d.ts
preesistente preservato. Test applicativi non ripetuti per questa unità
documentale; controlli pertinenti: hash/ignore originale, coerenza conteggi e
riferimenti, formato documenti e diff. Commit/push non eseguiti in questa unità.

**Aggiornamento successivo della stessa sessione:** Marco ha chiesto di scrivere
la bozza su WhatsApp per inviarla personalmente. Inserito il solo testo di
drafts.md nella chat Tony McIntyre già aperta. Testo integrale verificato nel
composer, pulsante Send disponibile, nessun click Invia e nessun tasto Return.

**Prossimo passo:** invio manuale di Marco della bozza in WhatsApp. Lavoro tecnico
indipendente pronto: preflight XLSX soltanto locale con provenienza e anomalie,
senza payload importabile o DB. Chiarimento da Tony: Schedule ID di programma o
Activity ID della singola attività. Regole schede di gruppo ancora aperte.

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

### Identificazione database Production — verifica in sola lettura

Confermato di nuovo mode neon dall’endpoint pubblico. Estratti dalla sola
configurazione locale hostname Neon e database neondb, senza mostrare o salvare
URL completa/password; **nessuna prova che siano il target Production**.
Nessun collegamento/sessione CLI Vercel/Neon disponibile e nessun connettore già
collegato. Nessun browser visibile mosso e nessuna query SQL effettuata.

Il [piano](local-demo-and-remote-plan.md) ora contiene evidenza locale/Production
separata, intervento minimo nella dashboard Vercel/console Neon e un
[manifest concreto](demo-payload-manifest.json). Payload solo revisione, target
nullo: progetto proposto demo-northbank-20261015, 120 task e 120 eventi, JSON
progetto con 28 asset/100 attività/2 revisioni. Cinque account e tre aziende da
mappare, nessun provisioning implicito. Validazione offline superata; verifica
remota, target esatto e assenza ID ancora pendenti. Nessuna scrittura remota.

### Chiusura comunicazione e agente persistente — resoconto della chat vocale

- **OUT-20261015-06 / 20:19:** messaggi copilot/autopilot inviati secondo il
  resoconto; testo integrale non fornito al root, quindi non ricostruito o citato.
- **MSG-20261015-2021 / 20:21:** task collegati a check sheet tramite asset tag o
  gruppi asset; un task può applicarsi al gruppo. Tony offre una lista asset di
  esempio. Nessun nuovo file acquisito; requisito registrato come CX-009, non
  equiparato automaticamente al parentAssetId o ai tag per livello già esistenti.
- **OUT-20261015-07 / 20:23:** saluto finale unico inviato e letto, verifica
  riferita dalla chat vocale; testo non fornito, nessuna ricostruzione.
- Risposta successiva di Tony, **ora non rilevata** nel resoconto: dalla prossima
  settimana sarà via 10 giorni ma lavorerà da remoto. Nessuna data di consegna
  o disponibilità continuativa dedotta da questo messaggio.

Marco ha chiesto di non scrivere altro, di rendere persistente l'agente e di far
avanzare il progetto mentre Codex resta aperto. La chat vocale conferma creazione
**ACTIVE** del heartbeat **Agente progetto Tony** ogni 15 minuti in questa chat.
Questo root non crea automazioni duplicate. README/AGENTS/stato sono il protocollo
per la ripresa; avvisi solo per cambiamenti utili o interventi necessari.

Marco autorizza esplicitamente l'impalcatura copilot ora, con esempi, prima della
chiave. La decisione credential gate è **chiave fornita più avanti dall'utente**;
nessuna richiesta ripetuta, creazione, riuso silenzioso, proxy Codex o chiamata a
pagamento. Discovery solo presenza: processo e .env.local senza OPENAI_API_KEY.
Nessun backend AI attivo dichiarato. La skill chiave resta applicabile al setup
futuro; questa istruzione utente autorizza scaffold senza live API.

Protocollo persistente verificato: heartbeat locale agente-progetto-tony di tipo
heartbeat, status ACTIVE, target chat 01a1407b-ee5f-72a0-bc3e-f883cdd78130.
Link locali dei documenti verificati, 13 originali riconciliati per dimensione e
SHA-256 e hash del payload di revisione verificato. Nessuna automazione creata
o modificata dal root. Prossima unità: AI-001/002, scaffold copilot autorizzato
con provider disabilitato e nessuna chiave/chiamata live.

Avvio AI-001/002 dopo push protocollo cc14c07: backend/permessi/proposte, provider
Responses disabilitato per default e UI copilot sviluppati in blocchi indipendenti.
Nessuna chiave presente (solo controllo booleano), nessuna live API, nessun DB
remoto. Root integra e verifica; non confondere scaffold in corso con AI attiva.

### Consegna Copilot — 15 ottobre 2026, 21:22 Europe/Rome

**0f80a4e**, commit e push su main verificati tramite ref remota; Vercel
`success / Deployment has completed` per lo stesso SHA. Il deploy è verificato
dal suo stato, mentre il collaudo autenticato è stato svolto esclusivamente nella
demo locale isolata. Smoke pubblico `/copilot`: bundle presente e redirect Next
verso `/` per sessione assente (HTML streamed HTTP 200 con meta refresh), senza
dati di progetto. Nessuna nuova migrazione o scrittura sul DB remoto.

- `/copilot`, link secondario/More, richiede ruolo di gestione e moduli Tasks e
  Commissioning; worker esclusi e progetto non assegnato non consultabile.
- Controlli reali: scaduti con date programma, test mancanti/non registrati e
  approvazioni distinte dai test; fonti navigabili e gruppi padre/figlio esistenti.
  Ricerca task disponibile al provider; testo dei record trattato come dato.
- Chat con esempi modificabili, stato onesto senza chiave, nessuna risposta finta.
  Provider server OpenAI Responses, URL fisso, `store:false`, chiave/modello/
  `COPILOT_ENABLED=true` tutti necessari. Fino ad AI-003 nessuna live call.
  Limiti: quattro richieste, sei tool call, 1.500 output token per richiesta,
  8.000 caratteri risposta, timeout complessivo 20 secondi. Cronologia limitata
  alla pagina e azzerata al cambio progetto; `store:false` non promette assenza
  di ogni conservazione provider.
- Proposte manuali già utili senza chiave: titolo, descrizione o priorità di un
  task, motivo, confronto prima/dopo e conferma separata. HMAC con segreto della
  sessione HttpOnly lato server; token di 10 minuti legato a utente/sessione/
  progetto/versioni. Token alterati, replay, progetto/task cambiati e permessi
  revocati rifiutati. Salvataggio/audit tramite operazione task esistente;
  scadenza, assegnatario, workflow, test, review e programma preservati.
- **76 test unitari/PostgreSQL e 9 API PASS**, inclusi 13 test trasporto provider
  con mock e sette test dominio/firma. Typecheck, lint, format, build e diff check
  PASS. Nessun test live. Controllo Impeccable dei file UI: nessun rilievo.
- QA centrale in un batch desktop/mobile e una conferma finale: 1440×1000 e
  390×844, demo piena/vuota, esempi, invio disabilitato, anteprima che non modifica,
  conferma che aggiorna versione/storico, reset al cambio progetto e link More.
  Nessun overflow orizzontale; prova completata senza page error. Log HMR iniziali
  durante edit/build concorrenti risolti con riavvio demo e caricamento pulito.
  Screenshot privati ignorati in `output/playwright/copilot-*`.

**Ripresa concreta:** AI-001/002 completate. Attendere il setup sicuro della
chiave e autorizzazione d'uso di Marco (AI-003); non richiederli nuovamente a ogni
heartbeat. Per DATA-001 serve l'accesso ai metadati Production Vercel/Neon
indicato nel piano; non eseguire import. Per CX-009 acquisire l'esempio asset se
diventa disponibile senza interferenza e chiarire identità/membri/stato condiviso
prima di implementare task di gruppo. Nessun nuovo messaggio Tony. Se non emergono
nuove prove o richieste, heartbeat silenzioso: non rifare UI/test appena conclusi.

### Heartbeat — 15 ottobre 2026, 21:24 Europe/Rome

Protocollo, PRODUCT e stato riletti; HEAD d7d78b3, unica modifica preesistente
next-env.d.ts preservata. Vercel `success / Deployment has completed` verificato
anche per d7d78b3. Nessuna attività implementativa rimasta in corso; nessuna suite
o QA ripetuta. PRODUCT allineato alla consegna Copilot già verificata.

Computer use segnala **Mac bloccato, sblocco automatico non disponibile**:
WhatsApp non accessibile, nessuna nuova lettura o acquisizione, copertura invariata
(diretta 19:20; resoconti 20:23 e risposta successiva). Nessuna finestra/tab mosso,
nessun messaggio composto/inviato. Non richiedere lo sblocco a ogni ciclo: riprovare
solo all'occasione consentita. Prossimi passi restano chiave/autorizzazione AI-003,
metadati DB e lista/regole gruppi CX-009; nessuna scrittura remota o live API.
