# Project progress: curve pulite — 23 novembre 2026

## Fonte e perimetro

Marco ha fornito nella chat di progetto tre messaggi di Tony del18nov2026,
08:30:14–08:31:45, e lo screenshot annotato della curva. Tony chiede di non
aggiungere righe, evitare dati già presenti nella pagina, dare priorità alla curva
e renderla fluida. Indica come confronti possibili original/current, critical path
complessivo e percorso fino alla fine di Phase1. Sono fonti di requisito; il
mandato operativo resta quello manuale di Marco e delle istruzioni di progetto.

Alla domanda sull'esatto traguardo Phase1, Marco ha risposto **«non so»**.
Il percorso fino a Phase1 resta quindi da definire: nessun Activity ID, milestone,
legame o regola di fase è stato dedotto. Nessuna nuova lettura/invio WhatsApp;
monitor unico PAUSED. Il PNG fornito non è stato importato come dato applicativo.

## Risultato

- Curva al centro: rimossi sottotitolo, blocco KPI separato, differenza in punti,
  righe di copertura/conteggi, legenda ripetuta, slider e disclosure in fondo.
  Legenda con percentuali e data riunite in un'unica fascia compatta.
- Interpolazione monotona continua al posto dei segmenti H/V. I campioni e i
  conteggi conservano i valori salvati; niente overshoot, stime di date mancanti
  o proiezioni actual oltre la data di osservazione.
- Ispezione direttamente sul grafico con puntatore/touch e frecce, Home/End;
  slider ARIA e istruzioni accessibili conservano l'accesso da tastiera.
- Un selettore condiviso offre Overall, Original vs current e Critical path ·
  saved P6. Le opzioni prive di dati sono disabilitate. Current usa i finish
  salvati/working, senza riscrivere target o baseline originali.
- Critical path aggrega solo le attività classificate critical dalla regola P6
  salvata, senza ricalcolo CPM. Managed e valori mancanti restano unknown;
  copertura e working stale sono disponibili nel popup informativo.
- Formula, conteggi, limiti e tabella sono nel pulsante informativo già esistente.
  Copertura/tabella sono esplicitamente Overall, anche consultando la vista P6.
  Partial coverage resta indicata nella legenda delle serie interessate.

L'API esistente restituisce solo aggregati autorizzati: massimo240punti per
serie, stessa membership/ruoli/revisioni/no-store. Nessuno schema, migrazione,
dato business remoto, provider AI, credenziale o servizio aggiunto.

## Verifiche

- **394** test unitari/PGlite PASS, inclusi nuovi casi current distinto dal piano,
  finish mancanti, denominatori critical/unknown e classificazione stale.
- Test API progress PASS sia sulla demo gestita iniziale sia dopo la fixture P6:
  autorizzazioni, dati completi/aggregati, empty, no-store e stato invariato.
- **24/24** controlli browser PASS su demo locale sintetica: curve cubiche monotone
  entro0–100%, stop actual esatto all'asOf, valori API original/current/critical,
  tastiera/touch, vuoto/errore/Retry, nessun overflow desktop1440/mobile390/tablet768,
  curva visibile nella prima schermata mobile, nessun errore runtime. L'unico
  errore HTTP503 è quello introdotto intenzionalmente per verificare Retry.
- Lint, TypeScript, formato dei file cambiati, diff-check e build finale PASS.
  Impeccable detect `[]`; revisore indipendente **ship**, rilievo sulla popolazione
  della tabella corretto. Screenshot desktop/mobile e confronti ispezionati.
- PDF inglese4pagine `output/pdf/fieldtrack-progress-curves-20261123-en.pdf`:
  manifest pagina→modifica→fonte e render/ispezione **4/4 PASS**.
  SHA256 `907b888419267c7c85d42d0544eac3ddeaf36cace7ffd826d77e792b9d64d723`.
  Prove e originali sintetici privati in `output/tony/progress-clean-20261123/`.

La demo Northbank ha ricevuto120attività P6 fittizie esclusivamente nel processo
locale, con DB remoto/AI disabilitati. Nessuna equivalenza con i dati Tony;
le schermate non attestano viste autenticate in produzione. Demo/browser chiusi.
`next-env.d.ts` e tutte le modifiche preesistenti preservati e fuori dal commit.
Quota conto verificata all'avvio25%, uso ordinario consentito; nessun reset/acquisto.

## Rilascio e prossimo passo

Codice **7268dce13c22bb2edfcdac64d3a2f0db34b3f16b** pushato normalmente su main.
Vercel **dpl_HH8jLmKyeXASGgX4GQt3UVupSs2b READY**, alias
`time-tracker-tony.vercel.app` sullo stesso deployment. Smoke pubblico
`/overview`200 e API progress anonima401; verificato il **23nov2026,20:28:19CET**.
Ricevuta privata `output/tony/progress-clean-20261123/release-code.private.json`.
Nessuna vista applicativa autenticata di produzione attestata; collaudi interni
solo nella demo sintetica. Il successivo commit documentale conserva lo stesso
codice applicativo; la ricevuta finale ne verifica deployment e alias.

Prossimo passo funzionale: identificare l'esatto traguardo di fine Phase1 prima di
costruire quel percorso. Nessun nuovo monitor, invio o incarico implicito.
