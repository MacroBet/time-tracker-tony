# Guida visiva del rilascio FieldTrack — 16 novembre 2026

Mandato diretto di Marco: alla fine delle richieste di Tony raccogliere schermate
di tutte le modifiche per un PDF da inoltrare manualmente. È una regola di consegna
specifica FieldTrack/Tony, conservata in AGENTS e README; non è un nuovo mandato di
sviluppo, monitoraggio o invio. Il rilascio applicativo rimane quello concluso
`a7b486a`, codice `353c0e1`.

## Artefatto e copertura

Finale privato: `output/pdf/fieldtrack-visual-update-20261116-en.pdf`.
16 pagine in inglese, 19 schermate/dettagli riferiti alle modifiche effettive.
Il PDF riusa la Dashboard già acquisita e aggiunge solo le viste necessarie nella
demo locale del codice rilasciato. Titoli e didascalie spiegano comportamento e
limiti; gli identificativi tecnici non guidano la lettura.

| Pagine | Modifica mostrata                                                                       |
| ------ | --------------------------------------------------------------------------------------- |
| 1–2    | Dashboard/Reports, contatori separati, preview e preferenze personali/default Admin     |
| 3      | Report completo con finestra, totale, più righe leggibili e link agli stessi record     |
| 4–6    | Setup in Admin, creazione separata, rinomina con anteprima e destinazione XER esplicita |
| 7–8    | Tasks compatto, sei/sette colonne, passi obbligatori e proprietà con date distinte      |
| 9–12   | Today/Gantt, durata/colonne, scala/finestra, criticità P6 e vista mobile                |
| 13     | Popup contestuale e comando reale Show months sul display                               |
| 14–15  | Letture salvate lookahead e ricerca Schedule, totali completi e cronologia              |
| 16     | Controlli Send/Edit, prerequisiti voce locale, prove del rilascio e limiti              |

Il manifest privato `output/tony/visual-release-guide-20261116/manifest.private.json`
associa ogni pagina ai requisiti, screenshot originali/hash e rettangoli di dettaglio.
Copre N01–N33 e i riferimenti del piano; i cambi backend senza una UI fotografabile
rimandano alle prove applicative già concluse, senza simularne uno stato in produzione.

## Prove, custodia e limiti

Skill PDF applicata con marcatura artefatto prima dell'authoring; ReportLab e Poppler
già disponibili, nessuna dipendenza installata. Tutte le16pagine renderizzate e
ispezionate. Corretti ritagli di controlli/righe e, su revisione indipendente,
le etichette Not due e il frammento Send al bordo. Rinomina e import hanno pagine
separate per mantenere leggibili i dettagli. Testi/link/page number e confini
immagine verificati; hash e ricevuta finale in `qa.private.json` nella stessa custodia.

Solo dati sintetici locali, inclusi un XER inventato e una checklist con3/5passi
passati per illustrare il60%. Nessun originale Tony, trascritto WhatsApp, audio,
segreto o dato cliente è incluso nel PDF o aggiunto a Git. Le immagini restano
inalterate; i dettagli sono ritagli di presentazione nel PDF e sono tracciati.

Le schermate **non sono collaudi autenticati online**. Il rilascio Production
READY/success e alias200/APIanonima401 è già documentato nel
[report applicativo](intake-20261116-implementation.md#pubblicazione-approvata-e-verificata--16-novembre-2026).
Voce sul dispositivo reale e viste autenticate produzione restano da collaudare;
CPM completo e nuove metriche non sono dichiarati consegnati.

Nessuna modifica prodotto, push/deploy, import reale/DB remoto, API pagata,
microfono, pacchetto lingua, ricerca credenziali o nuova lettura WhatsApp.
343test/21API/build precedenti non ripetuti per il PDF. Server e tab demo propri
fermati, next-env preesistente preservato e monitor PAUSED. Il PDF è pronto
per Marco; **non inviato a Tony**.
