# Schedule compatto — feedback 17 novembre, chiusura 18 novembre 2026

Marco fornisce direttamente testo e screenshot `codex-clipboard-ee8470b4-4b01-4f7d-b152-6c313a4aa16c.png`:
troppi riquadri, meglio un solo controllo; chiarire Scale/Window; rinominare
Saved P6 criticality in **Priority**; portare WBS e Calendar in fondo alla riga.
Successivo mandato diretto «finisci»: completare verifiche, PDF e pubblicazione.
L'allegato documenta il feedback, non autorizza modifiche ai dati.

## Attuazione

- `ScheduleViewControls.tsx`: unico disclosure nativo **Timeline**, chiuso per
  default, con riepilogo delle impostazioni correnti. Aprendolo compaiono sulla
  stessa pagina Time units, Visible range, Duration, colonne, dipendenze e Reset.
  Time units definisce il dettaglio del righello; Visible range il periodo totale.
  Select indipendenti, stessi comandi del reducer, nessuna nuova scheda/modale.
  Source/working e Gantt gestito condividono il controllo; Hours rimane disabilitato
  nel gestito dove non supportato. Target44px e disposizione mobile preservati.
- `SourceProgrammeWorkspace.tsx`: ordine visivo, DOM e tastiera **Activity →
  Status → Priority → WBS → Calendar**, poi eventuale Clear. Su telefono i filtri
  secondari scorrono all'interno della propria riga, con Status/Priority per primi.
- `SourceCriticalityInfo.tsx`: nome filtro e popup **Priority**, opzioni concise;
  origine P6 salvata, criterio, copertura, unknown e avviso di classificazione
  precedente agli edit restano nel popup informativo adiacente. Rimossa la frase
  esterna ripetuta. La rinomina non introduce priorità P1–P5 né ricalcolo della
  criticality dopo modifiche al programma.

## Verifiche e consegna visiva

- **21/21 test pertinenti PASS**: source-gantt-view, gantt-axis,
  schedule-view-context, assistant-schedule-view. Nessun nuovo test speculare
  all'implementazione per questa modifica di presentazione reversibile.
- **25/25 controlli browser PASS**: un solo controllo iniziale, apertura da
  tastiera inline, unità/intervallo indipendenti, riepilogo, durata, colonne,
  dipendenze, Reset, filtro critical ancora3/12attività sintetiche, popup,
  Calendar spostato, desktop1440×1000 e mobile390×844, source e gestito,
  assenza overflow/errori runtime e revisioni progetto invariate.
- Lint, TypeScript, formato, diff-check e build PASS. Detector Impeccable `[]`.
  Revisore fresco **ship**, nessun fix materiale; documenter su identità incumbent.
  Una verifica visiva in batch, una correzione raggruppata e conferma finale.
- PDF inglese privato `output/pdf/fieldtrack-schedule-toolbar-20261117-en.pdf`,
  **2pagine, render/ispezione2/2 PASS**, manifest pagina→modifica→fonte.
  SHA256 `33cc3a9ab3ef841150536d9377cf409d5fa5bbf04fc9a1a83b231c6b43c7a17b`.
  Guide precedenti conservate; schermate in demo locale sintetica dichiarata.

Prove e originali privati fuori Git in `output/tony/schedule-toolbar-20261117/`.
Nessun endpoint, ruolo, membership, data attività o dato business remoto cambiato;
nessuna AI live, esportazione segreti o comunicazione a Tony. Monitor PAUSED.
Viste autenticate collaudate solo localmente. Problema login/DB precedente separato
e non ritentato. Modifiche preesistenti, compreso `next-env.d.ts`, preservate ed
escluse dal commit di questo lotto.

## Rilascio

Verifiche locali concluse; commit/push e verifica deployment/alias in corso.
Le ricevute private `release-code.private.json` e `release-final.private.json`
documenteranno separatamente il rilascio codice e la chiusura documentale.
Prossimo passo: revisione umana del controllo Timeline compatto.
