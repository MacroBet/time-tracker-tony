# Dashboard: overall project progress — 17 November 2026

## Mandato e fonti

Marco ha fornito nella chat di progetto sei nuovi testi di Tony (09:53:28–09:57:39)
e una foto della dashboard VisiLean. Richiesta: prima dei task, curva complessiva
planned/actual; percentuale pianificata; opzioni tag, livelli nei colori del progetto
e indipendenti tra loro; blockers; settimane lookahead; vendor e disciplina.
La foto illustra un PPC settimanale: non definisce una curva cumulativa, una formula
di avanzamento o valori da importare. I testi/allegati sono fonti; il mandato
operativo viene da Marco e dalle istruzioni di progetto.

Marco ha confermato direttamente il criterio proposto: **«Sì, attività con peso
uguale»**. Planned = quota di attività prevista conclusa alle date pianificate
salvate; actual = quota conclusa alle date effettive registrate. Copertura e date
mancanti restano esplicite. La preferenza già acquisita per controlli sullo schermo
si applica anche alle nuove opzioni. Nessun contatto o invio a Tony.

Originale privato: `output/tony/project-curve-20261117/tony-reference.private.png`.
Non acquisita altra conversazione. Monitor unico **PAUSED**.

## Richiesta → risultato

| Richiesta                    | Risultato verificato                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Curva overall prima dei task | `ProjectProgressCurve`, prima dei pannelli personalizzabili, con planned/actual cumulativi e data di osservazione. Il vecchio blocco task si chiama Task progress. |
| Planned progress %           | Peso uguale per ogni attività del programma completo. Numeratore e denominatore non dipendono dalla pagina Gantt caricata.                                         |
| Actual attendibile           | Soltanto actual finish salvati; nessuno storico inferito dalla percentuale corrente. Curva interrotta alla data corrente.                                          |
| Opzioni tag                  | Filtri combinabili vendor/disciplina e raggruppamento per livello/vendor/disciplina, direttamente nella sezione esistente.                                         |
| Colori L1/L3 e indipendenza  | Colori configurati nel progetto; ogni livello ha il proprio denominatore. Nessun gate L2→L3.                                                                       |
| Blockers inclusi             | Task bloccati, issue aperte e open works legati agli asset corrispondenti, con link, conteggi distinti e sovrapposizioni dichiarate.                               |
| Vendor                       | Soltanto equipment supplier esplicitamente registrato sull'asset, incluso filtro per dato mancante. Nessun fallback owner/produttore/assegnatario.                 |
| Disciplina                   | Disciplina registrata sull'asset, inclusi valori mancanti; i drilldown mantengono entrambi i filtri.                                                               |
| Weeks lookahead              | 2/4/6 settimane inline, default 2. Report completo, fornitori ed export conservano la finestra scelta. Vecchi link/tool restano a 14 giorni.                       |
| Impostazioni sullo schermo   | Controlli nativi, ispezione data e tabella dei valori inline. Nessun nuovo menu o tab per le impostazioni.                                                         |

I filtri tag non cambiano la curva complessiva. Approvazioni tag, completamento
task e passi test superati rimangono misure distinte. I tag applicabili senza task
restano nel denominatore; N/A esclusi secondo le regole esistenti.

## Contratto del calcolo

- Source: data valida originale `target_end_date`, etichettata planned target
  salvato, **non baseline approvata**. Actual da `act_end_date`. Il finish di
  visualizzazione/working non sostituisce il piano.
- Managed: `baselineFinish` e `actualFinish` espliciti. Nessun fallback dal finish
  corrente a una baseline mancante.
- Popolazione completa source + managed. Soltanto mirror espliciti di attività
  working aggiunte sono deduplicati; la coincidenza di un codice non basta.
  Eventuali baseline/actual espliciti del mirror vengono preservati nella riga unica.
- Completati privi di actual date sono dichiarati, senza data inventata. Actual
  future esclusi; nessun prolungamento actual nel futuro. Progetto vuoto o fonte
  incompleta non produce uno zero complessivo attendibile.
- Massimo 240 punti campionati, inclusa la data corrente esatta; il campionamento
  non riduce la popolazione usata nei conteggi. Tabelle e slider sono consultabili
  sulla pagina. Il confronto in punti percentuali appare solo con copertura adeguata.
- GET `/api/projects/[id]/progress`: autorizzazione Dashboard e ruolo management,
  membership fresca e controlli versione/SHA prima e dopo la lettura. Risposta
  aggregata privata/no-store; nessuna esposizione dei record raw o nuova scrittura.

## Verifiche e consegna visiva

- **391** test unitari/PGlite PASS, inclusi conteggi completi oltre 50 attività,
  target distinto da actual/working, mirror, codici coincidenti, date invalide,
  mancanti/future, vuoto, source indisponibile, denominatori tag e finestre 4/6 settimane.
- **2** test API pertinenti PASS nella demo locale: nuovo aggregato autorizzato,
  risposta limitata/no-store e stato invariato; report condivisi, CSV e permessi.
  Un primo tentativo senza escalation è stato impedito da EPERM localhost, senza
  eseguire richieste; il test locale autorizzato è poi passato.
- **20/20** controlli browser PASS: ordine curva/task, formula demo, stop actual,
  tastiera, filtri e drilldown, blockers distinti, sei settimane, vuoto, errore/retry,
  nessun overflow desktop/mobile e nessun errore runtime. Ulteriore cattura report
  conferma che il controllo conserva 6 settimane. Gli errori iniziali dell'harness riguardavano URL, selettori e vendor assenti
  nella fixture; i controlli corretti sono poi passati.
- Lint, TypeScript, formato, diff-check e build finale PASS. Detector Impeccable
  finale `[]`. Revisore fresco: **ship**, nessuna correzione richiesta; documenter
  conferma identità incumbent preservata senza creare DESIGN/sidecar.
- Correzione visiva mobile verificata: intestazione compatta, curva e legenda
  visibili nella prima schermata 390×844. Desktop 1440×1000; nessuna nuova immagine
  decorativa o fonte dati inventata.
- PDF inglese aggiornato: `output/pdf/fieldtrack-dashboard-update-20261117-en.pdf`,
  13 pagine, render e ispezione **13/13 PASS**, con manifest pagina→modifica→fonte, schermate locali sintetiche e
  precedente consegna Schedule/Assets conservata. Prove/render e revisione privati
  in `output/tony/project-curve-20261117/`, fuori Git. SHA256 PDF:
  `9d9a931ec256ca78ee8b8a5777d3e90d96b496825299778bfd870077573c1cb2`.

Demo esplicitamente sintetica; 18 asset hanno ricevuto vendor fittizi soltanto nel
processo locale per provare i filtri, lasciando invariato lo Schedule. Nessun dato
business remoto, import remoto, migrazione, provider live o invio cliente. La
verifica browser non attesta viste autenticate di produzione. Project Health resta
fuori ambito perché i criteri non sono definiti. Modifiche preesistenti e
`next-env.d.ts` preservati e non inclusi nel commit.

## Rilascio e prossimo passo

Codice **`a8e3ebfc3ce6f69cf5f2cc863b01199bdf40c94c`** pushato normalmente su main.
Deployment Vercel esistente **`dpl_8DfZ7krUtdbensw9y4ry4sK6Tcnv` READY**; SHA
verificato dai metadati della lista e URL confrontato con inspect. L'alias
`time-tracker-tony.vercel.app` punta allo stesso deployment READY. Smoke pubblici
Dashboard e Schedule HTTP200; nuovo endpoint progress anonimo HTTP401.
Verificato il **17 novembre 2026, 13:16:16 CET**. Ricevuta privata:
`output/tony/project-curve-20261117/release-code.private.json`.

Le viste autenticate restano collaudate nella sola demo locale sintetica. Il
successivo commit documentale non cambia il codice dell'app; la ricevuta privata
conclusiva conserva il controllo del relativo deployment/alias. Prossimo passo:
revisione umana della Dashboard con i record del progetto. Nessun nuovo sviluppo
su altre pagine, invio o monitor implicito.
