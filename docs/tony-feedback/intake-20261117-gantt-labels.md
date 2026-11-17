# Nomi nelle barre Gantt — 17 novembre 2026

Marco richiede, con screenshot annotato fornito direttamente: «use the text not
the number inside the bar if it doesnt fit let them hover over it to see what it
is». L'immagine è una fonte di feedback, non un'autorizzazione a cambiare dati.
Originale privato: `output/tony/gantt-labels-20261117/source.private.png`.

## Risultato

- Programme source/working: dentro la barra compare `row.name`, al posto del
  riferimento attività.
- Schedule gestito: dentro la barra compare `r.name`, al posto della percentuale
  o del riferimento. Il riempimento che rappresenta il progresso rimane visibile.
- I nomi lunghi usano un'ellissi entro la larghezza della barra. Il `title`
  preesistente conserva il nome completo per il tooltip nativo al passaggio del
  mouse; l'etichetta accessibile completa rimane disponibile al focus. Enter apre
  i dettagli esistenti con il nome completo.
- Identificativi nella tabella, milestone, date, durate, percentuali salvate,
  permessi e gesti di modifica rimangono invariati. Nessun endpoint o dato remoto
  modificato.

Due soli componenti cambiati: `SourceProgrammeGantt.tsx` e
`ScheduleWorkspace.tsx`, cinque righe aggiunte e cinque rimosse.

## Prove

- **20/20 controlli browser locali PASS**: source9, gestito10 e apertura con
  tastiera1. Testo effettivo dei nomi, assenza di ID/% come etichetta, ellissi CSS,
  contenuto completo del title, aria label, Timeline mobile, nessun overflow,
  revisione invariata e nessun errore runtime.
- Quattro schermate valide: source e managed, desktop1440×1000 e mobile390×844.
  La cattura mobile gestita iniziale mostrava Activities: riacquisita selezionando
  Timeline. La cattura source mobile è stata portata alle righe Gantt. Nessun
  cambiamento al layout per correggere una semplice cattura.
- Il tooltip nativo del browser non è renderizzato nei PNG: verificati attributo
  `title` e hover/focus, senza dichiarare una prova visiva del tooltip di sistema.
- Lint, TypeScript, formato, diff-check e build finale PASS. Nessun nuovo test
  unitario per la sostituzione reversibile del testo. Detector finale `[]`.
- Revisore Impeccable fresco: **ship**, nessuna correzione materiale. Estensione
  Operate precisa dell'identità esistente; nessun concept roll, nuovo DESIGN,
  token o drift fix.
- PDF inglese privato `output/pdf/fieldtrack-gantt-labels-20261117-en.pdf`,
  **2 pagine, render/ispezione2/2 PASS**, manifest pagina→modifica→fonte.
  SHA256 `840159e1d690ef2b1bdbc7459dfb808a6e38f412f8ffbfc72bf818ba5734d612`.
  Il precedente PDF dashboard/Schedule di13pagine resta invariato.

Prove, immagini e fixture esclusivamente sintetiche locali, fuori Git, in
`output/tony/gantt-labels-20261117/`. Il piccolo programme P6 di12righe è stato
caricato soltanto nel processo demo locale. Nessun test su dati business remoti,
AI live, nuovo servizio, microfono o invio Tony. Monitor PAUSED. Residui precedenti,
inclusi documenti sull'accesso admin e `next-env.d.ts`, preservati.

## Rilascio e limiti

Codice **`0e66a112e4d1039df523924f7d81b73b6c52a65b`** pushato normalmente su main.
Deployment **`dpl_FVqdpmGjLBmLDqJR4iAMRhJY9osX` READY**, SHA associato dall'elenco Vercel;
alias `time-tracker-tony.vercel.app` sullo stesso deployment. Smoke pubblici:
Schedule200, API programme-source anonima401. Verificato **17 Nov 2026 18:57:42 CET**.
Ricevuta privata `output/tony/gantt-labels-20261117/release-code.private.json`.
Il successivo aggiornamento documentale non modifica il codice; ricevuta finale
conservata nello stesso percorso privato come `release-final.private.json`.

L'accesso admin Production precedentemente fallito con500 resta un problema
separato: la connessione DB disponibile risponde402/quota Neon e il valore/branch
Production non è stato confrontato. Nessun nuovo tentativo di reset, export di
segreti, acquisto o upgrade in questa consegna. Le viste autenticate nuove sono
verificate nella demo locale, non in Production.
