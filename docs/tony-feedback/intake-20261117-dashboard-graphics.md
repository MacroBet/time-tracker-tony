# Dashboard grafica e correzioni annotate — 17 novembre 2026

## Mandato e fonti

Marco chiede direttamente di usare Impeccable per sistemare la dashboard e applicare
le annotazioni su due screenshot allegati. Fornisce tre testi di Tony del 17 novembre,
07:56–08:09: prima impressione della dashboard prioritaria, grafica oltre alle sezioni,
una pagina alla volta. Nessuna lettura WhatsApp aggiuntiva: la fonte è il pacchetto
diretto di Marco, non un avanzamento della copertura storica.

Marco conferma poi esplicitamente la lettura del secondo screenshot: «Sì, applica
queste tre modifiche» alla domanda su eliminazione Supply, azioni accanto al nome
e larghezze delle colonne regolabili. Gli screenshot sono riferimenti; il mandato
umano autorizza l'implementazione. Originali, hash e prove sono privati in
`output/tony/dashboard-20261117/`, esclusi da Git.

## Risultato

| Richiesta                          | Attuazione                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard con grafici visibili     | Distribuzione degli stati dei task, barre di completamento per fase, approvazioni per livello e curva cumulativa baseline/forecast/approvazioni.                                                             |
| Prima impressione                  | Metriche e confronti in apertura; personalizzazione compatta, dettagli secondari richiudibili e lookahead/attenzione affiancati su desktop.                                                                  |
| Grafici utilizzabili               | Contatori, stati, fasi e livelli aprono i report già esistenti. Numeri e regole derivano dalle stesse funzioni di dominio.                                                                                   |
| Mobile                             | Prima schermata 390×844 con quattro metriche, distribuzione degli stati e due barre di fase sopra la navigazione; assi della curva in HTML a 12px.                                                           |
| Duration non richiesto nella barra | Selettore trasferito dentro Columns, sia nel programma sorgente sia nel Gantt gestito. Dati, preferenze e comandi conservati.                                                                                |
| Colonna percentuale e date         | Intestazione `%` con descrizione accessibile; Start/Finish in DD/MM/YYYY. Valori salvati e date input restano ISO.                                                                                           |
| Frecce, non calendari ripetuti     | Navigazione di riga tramite freccia; frecce direzionali compatte per attività fuori dalla finestra al posto dei link ripetuti. Il date picker resta un controllo data.                                       |
| Supply non richiesto nel registro  | Rimossi colonna e filtro della sola vista registro; classificazione salvata, editor e altri report preservati.                                                                                               |
| Azioni accanto all'asset           | Edit/copia/duplicazione/eliminazione nella cella identità, sotto nome/riferimento, con etichette accessibili e protezioni esistenti.                                                                         |
| Larghezze regolabili               | Asset, Equipment, Area e Phase ridimensionabili con puntatore/tastiera; Home o doppio clic ripristinano. Stato della sola vista aperta.                                                                      |
| Tabella più leggibile              | Intestazione Equipment semplificata; nomi completi dei livelli nei tooltip, codici compatti in tabella. Collegamento report ridondante rimosso; fallback Equipment status conservato per chi non ha Reports. |

Il default mette i grafici dei tag dopo la sintesi. Default di progetto e preferenze
personali esplicite continuano a prevalere; nessuna configurazione remota modificata.
Completamento task, passi dei test e approvazioni dei tag rimangono misure distinte.
Nessun Project Health inventato, zero e dati mancanti restano distinti.

## Verifiche

- Bootstrap progetto, Impeccable context e craft-floor letti; guida Next locale
  `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`.
- Fetch iniziale riuscito: HEAD e origin/main `b6f5892`, 0/0. Checkout documentale
  preesistente e `next-env.d.ts` preservati; nessun pull/reset/stash.
- Ownership parallela circoscritta a Schedule e Assets; integrazione dashboard,
  collaudo e rilascio centrali. Revisione e documentazione Impeccable indipendenti.
- **372 test unitari/PGlite**, **2 API pertinenti**, lint, TypeScript e build PASS.
  Le due API usano esclusivamente la demo locale e proteggono versioni/ruoli/identità.
- **28 controlli browser PASS**: drilldown, resize mouse/tastiera/reset, date, frecce,
  durata in Columns, dashboard vuota e nessun overflow pagina a 1440/1280/390.
  Verifica stabilizzata senza errori runtime/console. La precedente cattura troppo
  anticipata aveva provocato rumore di hydration dalla soppressione del caret:
  scartata e sostituita da prove dopo caricamento, con caret invariato.
- Detector meccanico Impeccable `[]`; hook senza rilievi. Revisore: due correzioni
  mobile richieste e poi entrambe **resolved**, disposition **ship** limitata alle
  correzioni valutate; non equivalente ad accettazione di Tony.
- PDF inglese privato di **7 pagine**, manifest pagina→modifica→fonte, font incorporati,
  render e ispezione di tutte le pagine. Percorso:
  `output/pdf/fieldtrack-dashboard-update-20261117-en.pdf`.

## Limiti e consegna

Screenshot e collaudi autenticati sono della **demo locale sintetica**: 120 task,
28 asset e 12 attività sorgente dimostrative. Nessuna scrittura business remota,
migrazione, import cliente, chiamata AI live o spesa aggiuntiva. Provider e credenziali
invariati; il gate AI già pendente non viene riaperto. Monitor PAUSED, nessun invio Tony.

Rilascio normale su main e Vercel esistenti entro il mandato AGENTS per il lavoro
richiesto. SHA, deployment e alias effettivamente verificati sono registrati nella
chiusura successiva; la build locale non è prova di pubblicazione.
