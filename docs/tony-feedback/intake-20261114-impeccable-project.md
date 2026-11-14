# FieldTrack - passata Impeccable su tutto il progetto, 14 novembre 2026

Mandato diretto di Marco: passata Impeccable sull'intero progetto e nuovo report
prima/dopo. Rimane valida la richiesta esplicita di PDF in inglese. Le cinque
schermate Tony restano fonti visive; nessuna loro annotazione diventa consenso
per nuove funzionalita AI, invii esterni o scritture remote.

## Perimetro e comportamento finale

Identita Inter/blu/slate conservata. Raffinamento Operate secondo Impeccable,
craft-floor e guide Next locali, con ownership indipendente e verifica centrale.

- Shell e controlli condivisi: testo secondario piu scuro, bordi input piu chiari
  da distinguere, focus tastiera, Skip to main content, bottoni/input alti almeno
  44 px e close dialog da 44 px. Dialoghi scorrono nel viewport. Titoli mobile
  abbreviati conservano il nome accessibile completo; sotto 360 px i comandi
  hanno una riga dedicata. Tabelle con regioni scrollabili e testate leggibili.
- Overview, Schedule/P6, Overdue, registro asset, report e Admin: gerarchia,
  toolbar, paginazione, numeri, date e matrici piu leggibili. Barre Gantt con
  bersaglio touch da 44 px, grafica interna e geometria temporale conservate.
- Planner, dettaglio attivita e assegnazioni: filtri mobile nominati, controlli
  selezione piu grandi, drawer leggibile, azioni e recupero filtri coerenti.
  Clear filters ora azzera anche livello, tipo equipment e entrambe le date.
  New activity conserva il progetto attivo se assegnato all'utente.
- People, timesheet, lavoro operatore, tempo e riepiloghi turno: etichette,
  metadati, stati vuoti, note ed evidenze piu leggibili, senza nuove regole ruoli.
- Checksheets/Works to go: record prima del setup, spiegazioni sotto Info,
  associazione in disclosure, selezione evidenziata con focus al dettaglio;
  cambio progetto azzera la selezione. Scritture disabilitate offline con motivo
  visibile. Firme e controlli si adattano al mobile.
- Login, Settings, assistente e feedback: gerarchia e label persistenti,
  stati pending/retry, aiuti compatti, form disabilitati durante il salvataggio.
  Stato provider e conferma delle proposte restano visibili; nessun provider edit.
- Corretto il collegamento Equipment status introdotto nel precedente lotto:
  utenti commissioning senza Reports mantengono la vista scoped esistente in
  /commissioning?view=status, con filtri/pagine e senza export. Chi ha Reports
  resta indirizzato alla relativa pagina; il gate Reports non viene ampliato.

## Prove e limiti

Baseline `289bdd5`, main allineato dopo fetch. Nessun reset/stash/pull necessario.
Modifiche documentali altrui preesistenti conservate e non incluse nel commit;
next-env.d.ts generato preservato/escluso. Nessun cambio server, schema o dipendenze.

- 204 test unitari/PostgreSQL e 12 API passati, piu lint, typecheck, formattazione
  dei file UI e build di produzione. Tsc dopo il build: l'esecuzione simultanea
  iniziale incontrava i file .next/types in rigenerazione, risolta sequenziando.
- 28 stati schermo a 1440x1000 e 390x844, prima/dopo; zero overflow pagina,
  controlli visibili senza nome o target sotto 44 px rilevati nella conferma.
  Un'unica correzione batch e
  conferma finale. Verifica aggiuntiva header a 320 e 768 px. Chromium locale,
  non certificazione accessibilita o collaudo su tutti i browser/dispositivi.
- Flussi: reset filtri completo, progetto nuova attivita, reset People,
  focus/selezione checksheet e cambio progetto, offline, refresh Settings,
  Skip link, focus menu More, close dialog, esempi assistente edit-only,
  gate Reports e vista commissioning senza Reports, errori login/retry.
  I due controlli iniziali non conclusi erano selettore Refresh ambiguo e attesa
  del redirect streaming: ripetuti mirati con selettore scoped/attesa URL, PASS.
- Confronto JSON prima/dopo interazioni: task e asset invariati, inclusi esiti e
  assegnazioni. Fixture synthetic checksheet/Works to go e P6 solo in demo locale
  in memoria; moduli utente temporanei ripristinati. Nessuna AI/transcription,
  credenziale nuova, messaggio esterno o scrittura dati remota.
- La conferma screenshot e stata ripresa dopo ERR_NETWORK_IO_SUSPENDED del
  browser locale, senza ulteriori cambi UI o cicli di polish.

Prove private: output/playwright/impeccable-project-20261114/. PDF inglese
aggiornato: output/pdf/fieldtrack-project-ui-review-20261114-en.pdf, con le cinque
richieste originali, il prima/dopo del polish esteso e viste finali mobile.
Originali, screenshot, log e PDF non sono versionati.

Quota nativa: 17% iniziale, 18% finale, ordinaryUsageAllowed=true; limiti globali
invariati e nessun reset/acquisto.

## Rilascio e prossimo passo

Codice `6c31917b4cc07707a14dd5a775473327279126ee` pushato su main. Vercel
Production `7787213884` success sullo stesso SHA e alias pubblico HTTP200
verificati il 14 novembre. Collaudo autenticato locale distinto dalla verifica
della pubblicazione. Il lavoro successivo annunciato da
Marco richiede il suo prossimo incarico; nessun avvio implicito del piano R2-R5.
