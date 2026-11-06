# Correzione P6 Gantt —6nov2026

Stesso job `tony-test-ready-delivery-20261105`. Mandato incrementale dalla regia:
Marco ha caricato P6 ma vede scala mesi illeggibile, barre e caricamento lento.
Lettore `root/tony_reply_reader6nov`: normale Programme LHR11
`08ef7190-c42e-46fc-9e2e-873d5c84dd0b`,16969attività/36923relazioni/13calendari/
3073WBS;1–50/16969, Months, ancora2026-11-06. Riscontro delegato UI, non verifica
DB/hash; caricamento riuscito, nessun nuovo file o reimport richiesto.

## Risultato applicativo

Days predefinito anche sul P6, colonne48px con data/weekday e weekend; Months
ora usa intervalli mensili leggibili. Apertura sull’inizio più antico della pagina
con due giorni di margine. Filtri/pagine riallineano alla fonte; navigazione date
manuale conservata fino a nuova selezione. Nomi/ID/date rimangono affiancati alla
griglia, barre per stato e milestone. Relazioni opzionali solo fra record visibili,
tipi FS/SS/FF/SF registrati, lag in ore nel dettaglio; nessuna relazione inventata.
Dettaglio modale mantiene scroll verticale/orizzontale e focus. Nessun ricalcolo o
conversione universale ore/giorni; nessuna scrittura o eliminazione dati cliente.

Ogni GET mantiene ruolo/modulo/membership correnti. Cache locale al processo,
chiave progetto/versione/contentHash, massimo2elementi, budget stimato48MiB,
TTL5minuti e invalidazione ai salvataggi. Cold query proietta solo cinque tabelle
utili; summary mantiene i conteggi originali. Warm query non ritrasferisce archivio
e riusa mappe/indice; dettaglio mantiene campi e legami originali. Nessuna migrazione,
infrastruttura, servizio o nuova API pubblica.

## Prove

20test mirati passati: date/asse, milestone/clipping, fedeltà P6/indice, limiti cache,
revoca membership e cambi versione/hash nelle query PostgreSQL locali PGlite,
conservazione archivio/audit. Typecheck, lint e build passati. Detector UI verde.
Browser Chrome headless isolato sulla build locale, sorgente P6 completo solo
nella memoria demo: desktop1440/mobile390, Days/ancora2026-03-28 sulle date reali,
nessun overflow pagina, ricerca ultimo ActivityID, dettaglio/focus/scroll invariati,
paginazione e Months leggibile; nessun pageerror. Nessun browser umano toccato.

Misura offline12query sul file completo32,630,685byte: vecchio decode+query mediana
255,75ms; indice caldo1,61ms. Cold decode+indice252ms. Proiezione14,338,842byte,
archivio warm0byte con metadata/membership comunque riletti. Budget stimato indice
43,015,689byte. HTTP nella demo locale prima109–120ms, dopo4–10ms su pagina/filtro/
dettaglio; payload dopo32KBpagina/41KBdettaglio campionato. Le misure non attestano
latenza DB/rete di produzione e il cold start resta un costo reale.

Prove private `output/playwright/p6-gantt-20261106/` e
`output/tony/p6-performance-20261106/measurement.private.json`; originali invariati,
nessuna fonte privata in Git. Scope di questa correzione concluso localmente;
rilascio verificato sotto. Job globale resta aperto: template, associazione e nuovo
worker task non ancora attestati online. Nessun import/DB remoto/WhatsApp/AI live.

Rilascio verificato: applicazione **e924c22**, push normale su main, Vercel
Production **success7596645304**,6nov09:20:14UTC (10:20:14Europe/Rome).
Ricevuta privata `output/playwright/p6-gantt-20261106/deploy.private.json`.
Nessuna nuova verifica autenticata in produzione; latenza online non misurata.
