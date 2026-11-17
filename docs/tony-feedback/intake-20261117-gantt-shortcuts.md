# Una sola freccia per attività — 17 novembre 2026

Marco fornisce uno screenshot inline dello Schedule con le frecce nella timeline
cerchiate e annotate «DEL», chiedendo «dont need to repeat». Richiesta diretta:
eliminare la duplicazione, mantenendo il comando accanto al nome attività.
Lo screenshot è una fonte di feedback, non autorizza modifiche ai dati.

## Modifica

Solo `SourceProgrammeGantt.tsx`: rimosso il pulsante di navigazione ripetuto
nella cella timeline delle attività datate fuori dalla finestra visibile.
Rimane la freccia primaria **Show dates** accanto al nome. Mouse e Invio portano
ancora l'attività nel calendario. Applicato a Working schedule e Original source,
che condividono lo stesso componente, anche su mobile.

Le celle fuori finestra restano vuote. Barre, nomi/tooltip, milestone, messaggi per
date non registrate, navigazione delle singole date e gesti di modifica rimangono
invariati. Il Gantt gestito, privo della stessa coppia di comandi a sinistra/destra,
non è stato esteso fuori ambito. Rimosso l'import ArrowLeft diventato inutilizzato.

## Verifiche

- **12/12 controlli browser locali PASS**: freccia primaria presente; copie assenti
  con date fuori finestra nel passato e nel futuro; celle timeline vuote; salto date
  con click e tastiera; nomi nelle barre preservati; Original source; mobile;
  nessun overflow, revisione invariata e nessun errore runtime.
- Screenshot desktop1440×1000 e mobile390×844. Fixture P6 di12attività esclusivamente
  sintetiche caricata solo nella demo locale. Le date gennaio2027 delle schermate
  sono una finestra di visualizzazione, non nuove date salvate sulle attività.
- Lint, TypeScript, formato, diff-check e build PASS; detector Impeccable `[]`.
  Revisore Impeccable fresco: **ship**, nessuna correzione materiale.
  Nessun nuovo test unitario per la rimozione reversibile di un controllo duplicato.
- PDF inglese privato `output/pdf/fieldtrack-gantt-shortcuts-20261117-en.pdf`,
  **1 pagina, render/ispezione1/1 PASS**, manifest pagina→modifica→fonte.
  SHA256 `4fb10de0a1817cec09c7d3cc30df3ec767eccda440c11c3cb913f7c33ce6fa2a`.
  Le precedenti guide restano storiche e invariate.

Prove, immagini e fixture fuori Git in `output/tony/gantt-arrows-20261117/`.
Nessun endpoint, dato business remoto, permesso o valore del programma modificato;
nessuna AI live, esportazione segreti o comunicazione a Tony. Monitor PAUSED.
I cambi precedenti, inclusi i documenti sull'accesso admin e `next-env.d.ts`, sono
preservati. Il problema Production login/DB già registrato non è stato ritentato:
viste autenticate verificate soltanto nella demo locale.

## Rilascio

Codice **`4391404523c368e8c30bfcab95bbeff853326f01`** pushato normalmente su main.
Deployment **`dpl_E8RoChx6aQDw3wXqvvXCsynBs3uM` READY**; alias pubblico sullo stesso
deployment. Smoke Schedule200/API programme-source anonima401. Verificato
**17 Nov 2026 19:11:59 CET**. Ricevuta privata
`output/tony/gantt-arrows-20261117/release-code.private.json`.

Documenter Impeccable: identità incumbent preservata, nessun nuovo DESIGN/sidecar
o drift fix. Il successivo aggiornamento documentale non cambia il codice;
ricevuta di main/alias conclusivi in `release-final.private.json` nello stesso
percorso privato. Prossimo passo: revisione umana della singola freccia per attività.
