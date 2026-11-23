# Insegnamenti di lavoro — Marco / FieldTrack

Registro incrementale, non trascritto. **E** = regola/preferenza esplicita di Marco;
**T** = scelta specifica Tony/FieldTrack; **H** = ipotesi non generalizzabile.
Una preferenza riferita è evidenza della preferenza, non prova tecnica del prodotto.
Fonte del riepilogo delle correzioni: resoconto della chat operativa trasmesso il
16 ottobre 2026; dettagli storici nel [registro](register.md) e [recap](collaboration-recap.md).
Le righe seguenti non concedono nuove autorizzazioni.

| ID / ambito | Insegnamento e applicazione                                                                                                                                        | Risultato o evidenza / limite                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-01 · E    | Fare il lavoro richiesto e renderlo concreto prima di promesse; una domanda non autorizza sviluppo indiscriminato.                                                 | Correzione esplicita di Marco; consegne con SHA e prove nel registro.                                                                                                             |
| L-02 · E    | Risposte italiane brevi e amichevoli. Recuperare contesto/materiali prima di ripetere un chiarimento.                                                              | La domanda sugli ID è risolta da «Both required»; non riproporla.                                                                                                                 |
| L-03 · T    | Inglese colloquiale a Tony, messaggi brevi separati e testo adeguato alle parole di Marco prima dell'invio.                                                        | [Bozze/storico](drafts.md); non estendere tono o destinatario ad altri progetti senza contesto.                                                                                   |
| L-04 · E    | Ogni futuro messaggio esterno richiede approvazione puntuale. Composer solo se richiesto; gli invii singoli autorizzati sono conclusi.                             | Revoca delle autorizzazioni temporanee precedenti; resoconto invio unico 16/10 12:10 nel registro.                                                                                |
| L-05 · E    | Separare test locale, commit, push e deploy; separare demo da produzione.                                                                                          | CX-010: 86+10 test, push verificato, Vercel success; prova autenticata solo locale. Nessun seed remoto.                                                                           |
| L-06 · E/T  | Dataset rappresentativo e empty state guidati rendono verificabili i percorsi; mostrare nel Chrome visibile quando richiesto.                                      | UX consegnata e fixture Northbank/empty, desktop/mobile provati. Fixture locale sintetica, non dati Excel né prova di Production.                                                 |
| L-07 · T    | L'AI è un copilot utile sui dati con proposte controllabili; spiegare il beneficio concreto.                                                                       | Controlli deterministici e proposte task consegnati; provider live disattivato, chiave più avanti. Autopilot da concordare.                                                       |
| L-08 · E/T  | Assenso commerciale e pagamento sono fatti diversi; non derivare spesa API o listino dal compenso.                                                                 | Tony «No probs» sui €1.000 aggiuntivi; pagamento non verificato, primo storico incerto.                                                                                           |
| L-09 · T    | Preservare l'identità dei record e le distinzioni di dominio; non inferire approvazioni o gruppi da colori/nomi.                                                   | CX-010 preserva ID/task/tag/date/baseline; esito test, avanzamento, I/R/AC/A separati. Regole gruppi ancora aperte.                                                               |
| L-10 · E    | Avvio soltanto manuale in una chat del progetto; nessun consumo periodico implicito dopo il turno.                                                                 | Decisione 16/10: heartbeat PAUSED, metadati locali confermati. Sostituisce la scelta ACTIVE del 15/10.                                                                            |
| L-11 · E    | Dopo processi significativi conservare soltanto nuovi insegnamenti dimostrati, risultato tangibile, prove, limiti e ripresa.                                       | Questa unità salva bootstrap, indice, recap e skill portabile; non trasformare complimenti in regole o prove tecniche.                                                            |
| L-12 · H    | Modelli diversi avranno memoria perfetta/identica; importo Tony valido come prezzo standard; gruppo padre equivale a scheda condivisa.                             | Ipotesi respinte: documenti verificabili, prezzi contestuali e semantica gruppi ancora da definire.                                                                               |
| L-13 · E    | Sincronizzare main prima del lavoro: fetch e confronto; pull ff-only soltanto su main pulito se necessario. Preservare le modifiche, senza reset/stash automatici. | Nuova istruzione di Marco, riferita dalla chat operativa il 16/10. In UX-004 fetch riuscito, HEAD/origin/main 0/0; nessun pull necessario, next-env.d.ts preesistente preservato. |

## Preservazione degli import parziali — 5 novembre

**T, dimostrato in 5f4cd7c:** distinguere un campo omesso da un file da una
cancellazione nel modulo. I default schema possono cancellare metadati prima del
merge: il lettore JSON integra i campi opzionali salvati prima della validazione,
senza riempire i campi obbligatori. Non cambiare il merge condiviso quando i moduli
usano l'omissione per cancellare date. Prova: regressione sintetica, reimport
idempotente, sorgente invariata, clear del modulo e validazione,29 test mirati.
Ambito: file asset JSON con lista esistente dello stesso progetto; non autorizza
inferenze, conversioni dei workbook cliente o scritture remote.

## Identità e dipendenze negli import XLSX — 5 novembre

**T, dimostrato in14692f6:** risolvere workbook/stringhe/stili dalle relazioni attive,
senza leggere parti orfane al loro posto; decodificare gli escape SpreadsheetML
una sola volta, preservando il prefisso `_x` minuscolo. Le date non si ricavano
da stili solo orario. Questi tre casi hanno regressioni sintetiche verificate.
La normale dipendenza ZIP/XML locale, consentita dalla delega corrente, è lavoro
tecnico: non va trasformata in una domanda business a Tony o in un nuovo GO.
Rimane distinta da accessi, servizi pagati, segreti e provider live.

## Proposta trasversale ancora da definire — 16 ottobre

Resoconto della chat operativa: Marco vuole coordinamento tra progetti semplice
da usare, protocollo/eventi/stato agenti, stime in intervalli di token e budget con
consuntivi. **T/H**: esigenza in discussione, non architettura consegnata o incarico
di modificare repository. La lezione applicabile è conservare la differenza tra
visione, autorizzazione concreta ed evidenza; niente costi inventati o oneri di
orchestrazione/stima a ogni domanda. La skill generale resta priva di nomi cliente.

## Durata P6 e calendario sorgente — 14 novembre 2026

**T, dimostrato nel lotto UI7678eeb:** la durata visuale in giorni si ricava solo
se il calendario dell'attivita contiene un `day_hr_cnt` valido. LHR11 contiene
calendari da8 e15ore/giorno: dividere universalmente per8 altera il significato.
Prova:16969/16969record convertibili, sorgente immutata e regressioni per dato
assente/invalido/zero. Ambito: unita visuale; non ricalcola date o logica P6.

## Applicabilita tag coerente e concorrenza — 14 novembre 2026

**T, provato con test PostgreSQL locale e API demo:** inline, edit e import devono
validare la rimozione dei livelli contro lo stato salvato, inclusi checksheet
senza task e link Schedule di livello. Anche cambiare il livello di una task sullo
stesso asset invalida una vecchia anteprima tramite versione progetto. Verificare
entrambi gli ordini: task prima della rimozione e rimozione prima della nuova task.
Il controllo atomico sui nuovi legami non deve bloccare aggiornamenti dei legami
invariati se un livello viene disabilitato successivamente. Esiti/firme restano
separati dalla configurazione. Ambito: contratti registro/task esistenti, nessun
nuovo permesso o scrittura remota impliciti.

## Aggiornamento

Aggiungere o correggere una riga solo quando c'è un insegnamento nuovo e fondato;
registrare data/fonte, ambito, comportamento da cambiare, esito verificato e limite.
Se una regola viene sostituita, qualificare quella vecchia e aggiornare l'istruzione
corrente, senza cancellare lo storico utile. Stato/backlog rimangono soltanto nel
registro. Non registrare segreti, dati bancari, chat estranee o audio ambientale.
La skill generale non deve includere questi dettagli di Tony.

## 16 novembre 2026 — prove sui percorsi reali e retry

- Un test del modulo non prova il punto d’ingresso dell’utente: Tasks monta
  `ManagementBoard`, non il branch management di `TaskBoard`; il Gantt legge
  `schedule-working`, non soltanto `programme-source`. La verifica centrale deve
  seguire pagina→componente→endpoint effettivi. In questo lotto ha recuperato
  un’integrazione non raggiungibile e un parametro critical non propagato.
- Per un comando idempotente, un receipt consumato non può riapplicare la mutazione
  dopo modifiche successive. Il caso A→B→A→retry della prima rinomina deve lasciare
  invariati l’intero progetto e l’audit, mantenendo il controllo corrente di accesso.

Prove: [attuazione16nov](intake-20261116-implementation.md), regressioni
`project-profile.test.ts`/API e `source-criticality-api.integration.ts`.

## 16 novembre 2026 — consegna visiva da inoltrare

**E/T, regola diretta di Marco:** a fine consegna Tony preparare screenshot di
tutte le modifiche e un PDF inglese con titoli/didascalie brevi, pronto da inoltrare
manualmente. Prima applicazione: [guida visiva16nov](intake-20261116-visual-guide.md),
16pagine renderizzate/ispezionate e manifest pagina→modifica→fonte. La revisione ha
mostrato che un'immagine di soli filtri non racconta un report: includere righe,
totali e link leggibili, con ritagli che non troncano etichette o azioni ai bordi.
Ambito Tony/FieldTrack; esempi sintetici dichiarati, produzione distinta, nessun
invio, microfono, nuovo sviluppo o autorizzazione remota impliciti.

## 17 novembre 2026 — lifecycle voce e recupero degli errori

- **T, regressione e browser verificati:** smontare la cattura non basta se un
  vecchio intento resta memorizzato. Al cambio progetto consumare l'intento nel
  contenitore effettivo; A→B→A non deve riaprire la voce o avviare una cattura.
  Prova locale tastiera di ritorno: zero dialoghi e nessun ascolto implicito.
- **T, test invariati conservati:** un report già ottenuto può recuperare un
  errore di narrazione/trasporto solo con origine e fase esplicite. Meter, tool,
  protocollo, accesso, versioni e cancellazione restano terminali. Testare anche
  `DOMException` nativa `AbortError`, che deve essere cancellazione e non fallback.
  La suite precedente di metering ha rilevato il difetto; correggere il codice
  senza indebolire l'aspettativa ha portato35test mirati e372finali aPASS.

Prove e limiti nel [completamento funzionale](intake-20261116-functional-completion.md).
Ambito: lifecycle e contratto applicativo, nessuna garanzia acustica universale
o autorizzazione a chiamate AI live derivata dai test sintetici.

## 23 novembre 2026 — accorpare i feedback prima delle verifiche complessive

**E, correzione diretta Marco nella chat di progetto:** «non fare test per tutto e
build ci sono altri4messaggi in attesa». Ambito FieldTrack/Tony e lotto corrente:
acquisire e lavorare i feedback collegati insieme, verificare in modo mirato dove
serve e rinviare suite complessive/build/consegna alla chiusura del lotto; evitare
un ciclo completo per ogni messaggio. Non significa saltare una verifica necessaria
per una modifica rischiosa. Fonte/esito: [Dashboard dinamica](intake-20261123-dynamic-dashboard.md),
codice424a1de già pushato prima della correzione e VercelREADY verificato in sola
lettura. Nessun altro build o push documentale avviato dopo la richiesta. Prossima
ripresa: i quattro messaggi annunciati; documenti locali da accorpare al lotto.
