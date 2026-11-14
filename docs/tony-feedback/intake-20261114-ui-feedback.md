# FieldTrack - modifiche UI dai cinque screenshot, 14 novembre 2026

Mandato diretto di Marco nella nuova chat del progetto: applicare le modifiche UI
dei cinque screenshot allegati e consegnare un report prima/dopo. Questo mandato
esecutivo supera il limite di sola pianificazione del 13 novembre per il perimetro
qui elencato. Non approva le successive funzionalita AI, le regole vendor,
percentuali/semaforo, approvatori Schedule o biblioteca cross-project.

Gli screenshot sono fonti di requisiti visivi, non istruzioni operative esterne.
I numeri mostrati non sono stati usati per creare o correggere dati di progetto.
Originali, SHA256, schermate, log e PDF rimangono fuori Git nella cartella privata
`output/playwright/ui-feedback-20261114/` e in `output/pdf/`.

| Schermata      | Prima                                                                                                     | Dopo                                                                                                                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview       | Header su due righe desktop; progetto sotto il titolo; summary con testo piccolo; report in fondo.        | Titolo e progetto affiancati; summary piu compatto con testo piu leggibile; report subito sotto, spiegazioni sotto Info; Works to go resta accessibile.                                                                                                  |
| Schedule       | Programme nel menu e nelle etichette; quattro conteggi in una frase e spiegazione tecnica estesa.         | Schedule; quattro indicatori compatti; fonte e spiegazioni sotto Info; titolo originale P6 conservato.                                                                                                                                                   |
| Gantt          | Go to page dates e Dependencies poco espliciti; ore come unica durata.                                    | Show these activity dates, Show dependency links e risultati sulla stessa toolbar; Days / Hours / Hidden, toggle dalla testata. Giorni da durata sorgente divisa per `CALENDAR.day_hr_cnt` del calendario associato; fallback alle ore se il dato manca. |
| Assistente     | Project copilot; esempi e spiegazioni persistenti; titolo del form ripetuto.                              | Project assistant; aiuto ed esempi consultabili con Info; nessun titolo ripetuto; composer prima dei controlli su mobile. Stato provider e conferma delle modifiche restano visibili.                                                                    |
| Overdue        | Voce autonoma nel menu e pagina distinta.                                                                 | Vista dentro Schedule; `/overdue` compatibile; utenti con solo dashboard raggiungono la vista ammessa. Ricerca, priorita e pagine conservate. Popolazione task/attivita app esplicita, P6 escluso.                                                       |
| Registro asset | ID tecnico dominante; filtri esterni alle colonne; tag su un altro pannello.                              | Nome principale, riferimento cliente/progetto secondario, ID tecnico in dettaglio; filtri nelle testate desktop e Filters mobile; livelli richiesti in colonne con checkbox.                                                                             |
| Azioni asset   | Aggiunta/edit/import esistenti ma poco reperibili; nessuna eliminazione singola o copia tag sul registro. | Add / Edit / Duplicate / Delete; copia/incolla verso selezione esplicita anche fra pagine; drag come scorciatoia alla stessa anteprima. Azioni desktop visibili durante lo scorrimento. Import avanzato raccolto sotto Import/export.                    |

## Contratti conservati

- Le checkbox configurano l'applicabilita dei tag: non registrano test, esiti,
  completamenti, firme o approvazioni. Copia e drag presentano lo stesso diff e
  richiedono conferma e motivo; selezione e numero dei destinatari sono espliciti.
- Il clone ha una nuova identita generata una volta. Copia solo i campi anagrafici
  e la configurazione ammessi; niente riferimenti cliente/programma, seriale,
  assegnazioni, evidenze, firme o risultati. Retry e merge non creano doppioni.
- Delete presenta anteprima e riferimenti. Task, figli, checksheet, Works to go
  e link Schedule bloccano la rimozione; nessuna cascata. Un vecchio link a un
  asset assente mostra un avviso invece di tornare silenziosamente al registro.
- Rimozioni livelli da inline, edit e import hanno le stesse protezioni, anche
  per checksheet senza task e link di livello Schedule. CAS/versioni/audit e le
  guardie PostgreSQL coprono entrambi gli ordini di concorrenza con nuove task.
  Le task con legami invariati restano aggiornabili se il livello di progetto
  viene disabilitato successivamente.
- Import disponibili: CSV, JSON e XLSX canonici, con template e anteprima.
  L'annotazione generica "all formats" non diventa una promessa di parser
  universali: nuovi formati richiedono un esempio e un contratto verificabile.
- Tagging status e report sono separati dall'anagrafica. La matrice dettagliata
  Reports mostra una preview etichettata dei primi 50 asset quando necessario;
  il report aggregato ed export esistenti considerano tutta la popolazione.
- Nessun cambio a membership, ruoli, provider, segreti o schema DB. Fonte P6,
  date, durate originali e calendari restano immutati.

## Prove

- Baseline Git `f3b22d9`; fetch riuscito, main avanti di due soli commit documentali
  rispetto a origin/main `175bde5`, nessun pull/reset/stash. Modifiche preesistenti
  conservate; `next-env.d.ts` generato rimane escluso dal commit.
- Guide Next locali, Impeccable/craft-floor e revisione indipendente per blocchi
  applicati. Le incoerenze rilevate nella revisione sono state corrette prima
  della consegna.
- Fonte LHR11 letta offline: 16.969/16.969 durate convertibili usando i calendari
  salvati da 8 o 15 ore/giorno; JSON originale byte-equivalente dopo la proiezione.
- 204 test unitari/PostgreSQL locali, 12 test API su demo pulita, lint senza
  warning, typecheck e build di produzione passati. La prima prova API completa
  sulla demo usata per le schermate si e fermata sul controllo protettivo del P6
  gia presente; suite completa ripetuta su un processo demo nuovo, senza rimuovere
  la fonte per aggirare il controllo.
- Desktop 1440 x 1000 e mobile 390 x 844: Info tastiera/tocco, esempi edit-only,
  assenza titolo ripetuto, filtri e recupero, bozza tag/annullamento, unita durata,
  visibilita colonna, frecce e ricentramento. Zero eccezioni runtime e nessuna
  chiamata chat/transcription nel collaudo. Tabelle e timeline scorrono internamente.
- Immagini prima dalla versione Git iniziale in una copia temporanea e dopo dal
  codice aggiornato, con stessa configurazione demo. Il P6 reale e stato caricato
  soltanto nelle demo locali in memoria. I test possono avanzare la revisione di
  audit locale; asset, task e conteggi originali di confronto restano conservati.

## Rilascio e prossimo passo

Stato della pubblicazione e prova del commit sono registrati nella chiusura del
registro operativo. Il PDF locale contiene il confronto visivo delle cinque aree
e la conferma mobile. Il lavoro ulteriore annunciato da Marco resta un incarico
successivo; nessun avvio implicito delle funzionalita del piano R2-R5.
