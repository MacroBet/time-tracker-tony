# Schedule: comandi sullo schermo e drag delle date — 17 novembre 2026

## Mandato diretto

Marco fornisce uno screenshot annotato e chiede controlli «integrated and changeable
on screen», senza cercare menu o schede nuove, più drag delle date senza tornare
sempre al campo superiore. Alla domanda che distingue navigazione del calendario
da modifica del programma risponde: **«Anche modificare le date delle attività»**.

Lo screenshot è una fonte di riferimento, non un'autorizzazione autonoma. La nuova
richiesta supera, per lo Schedule, la collocazione dei controlli dentro Calendar view,
Columns e Filters consegnata nel precedente incremento. Nessuna lettura WhatsApp,
invio a Tony, riattivazione del monitor o modifica Assets dedotta da questa richiesta.

## Attuazione

| Esigenza                            | Comportamento consegnato                                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Impostazioni sullo schermo          | Scala Day/Week/Month, finestra Auto/2/4/6 settimane, durata, colonne, dipendenze e Reset direttamente nello Schedule, senza popover di impostazioni. Componente condiviso fra sorgente e programma gestito.           |
| Filtri integrati                    | Ricerca, WBS, calendario, stato e criticità P6 visibili. Su mobile i filtri secondari sono una striscia orizzontale scorrevole; i comandi restano espliciti.                                                          |
| Drag per navigare                   | Trascinare il righello o lo sfondo della timeline sposta la finestra; la data superiore segue la vista. Non cambia record o revisioni. Tastiera Left/Right, Shift per una settimana.                                  |
| Data della riga                     | Start/Finish sono azioni per raggiungere la data salvata. Start appartiene all'attività e non deve essere sostituito con Today o con la data della finestra.                                                          |
| Drag delle attività                 | Barra per spostare, estremità per ridimensionare, preview durante il gesto. Alt+frecce sul controllo offre un'alternativa da tastiera. Supporto puntatore e touch; il gesto verticale continua a scorrere.            |
| Salvataggio integrato               | Proposta inline con date prima/dopo, motivo, Review date change e Confirm date change. Il drop e la sola preview non salvano. Annullamento/Escape conservano i dati.                                                  |
| Programma originale e date mancanti | Original source non modificabile con drag. Baseline e actuals preservati; milestone non ridimensionate; deadline senza Start mantengono Start mancante.                                                               |
| Permessi e concorrenza              | API/token/versione già esistenti; admin/manager confermano la propria proposta, supervisor solo preview. Offline, actuals e versione cambiata bloccano il salvataggio; niente ricalcolo CPM o date a valle implicito. |

Le modifiche passano da `schedule-working` anche per il programma gestito, senza
migrazione, nuovi provider o privilegi. Nessuna chiamata AI live o credenziale nuova.
Le modifiche delle date di produzione saranno normali azioni confermate dall'utente;
l'agente ha salvato esclusivamente record sintetici locali durante i test.

## Prove e limiti

- HEAD/origin `d4fcb1c` allineati dopo fetch; modifiche documentali preesistenti e
  `next-env.d.ts` preservati. Ownership parallela separata per controlli, drag e
  review; integrazione, collaudo e rilascio centrali.
- Impeccable applicato sul sistema visivo esistente, craft-floor e guida Next locale
  letti. Nessuna nuova identità visiva, dipendenza o token globale.
- **380 test unitari/PGlite PASS** (otto nuovi test di aritmetica drag/pan), lint,
  TypeScript e build PASS; detector `[]`.
- **Due test API pertinenti PASS** su una seconda demo locale vuota, porta3001.
  Il primo tentativo sulla demo già preparata si era correttamente fermato alla
  precondizione «fresh isolated demo», senza sostituire il programma esistente.
- Browser core **18/18**: controlli inline, finestra/colonne, pan senza revisione,
  salto da Start, nessuna richiesta di scrittura al drop, preview, conferma di una
  revisione, originale conservato, resize da tastiera e annullamento.
- Native touch, scroll verticale, Escape e resize con puntatore provati. Il Gantt
  gestito conserva una deadline senza inventare Start e salva una revisione con
  ricevuta/motivo; verifica finale gestito **4/4**. Ruoli **4/4**, con supervisore
  incapace di confermare; nessun errore runtime/console nelle prove concluse.
- Il primo script ruoli ometteva Origin nel login e quindi non cambiava utente:
  asserzione non valida, corretta nel collaudo successivo. I log interrotti non sono
  contati come suite riuscite. Gap iniziale nel drag delle deadline gestite corretto
  prima delle verifiche finali.
- Otto catture finali desktop/mobile ispezionate dal revisore indipendente:
  **disposition ship**, nessun rilievo materiale. Documentazione confrontata col
  sistema esistente; nessun aggiornamento globale di DESIGN o riparazione di drift.

Prove private in `output/tony/schedule-direct-20261117/`, originali esclusi da Git.
Tutte le viste autenticate e le scritture di prova sono della demo sintetica locale:
nessuna attestazione di UI autenticata o scrittura business Production.

## PDF inglese aggiornato

Aggiornata la guida `output/pdf/fieldtrack-dashboard-update-20261117-en.pdf` a
**9 pagine**: istruzioni Schedule precedenti sostituite dai comandi inline,
aggiunti drag/review/conferma e protezioni mobile/ruolo. Dashboard e Assets della
consegna precedente conservati come riferimento; copia privata dell'edizione7pagine
preservata. Font incorporati, manifest pagina→modifica→fonte, render e ispezione
**9/9 PASS**. SHA256 `cebd007f0ad5d757b85ef11dd95389943b77a413ea75d32089e1212eed997002`.

Pubblicazione normale su main/Vercel esistenti autorizzata da AGENTS per il lavoro
richiesto; stato e ricevuta del deploy saranno distinti dalle prove locali. Monitor
PAUSED, gate AI precedente invariato, nessun invio cliente.
