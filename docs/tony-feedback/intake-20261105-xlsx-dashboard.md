# Consegna locale XLSX asset e dashboard — 5 novembre 2026

## Mandato ed esito

Il supervisore, nella delega ricevuta in questa chat, ha riconfermato il mandato
umano di completare i due rami tecnici indipendenti: XLSX sullo schema asset già
definito e semplificazione della dashboard con le metriche esistenti. Una normale
dipendenza di progetto non richiede una nuova domanda business a Tony. Nessuna
nuova lettura di WhatsApp/mail/altre chat, richiesta di GO ordinario, job o scheduler.

**Entrambi i rami sono completati localmente**, commit applicativo **14692f6**.
Questo esito supera il loro stato «lavoro tecnico aperto» nell'audit precedente.
Le decisioni su sequenze comuni, checklist/approvatori, video e fedeltà P6 restano
distinte. Nessun messaggio cliente, composer, push o deploy.

## XLSX asset

Nuovo lettore nel browser caricato su richiesta e template Excel vuoto, con19
colonne canoniche formattate come testo. Un solo foglio visibile, tabella dalla
riga1; il file con più fogli richiede una copia separata di quello desiderato.
Conserva ID testuali/zeri iniziali e campi opzionali omessi. Booleani di fornitura
e date Excel1900/1904 intere mantengono le distinzioni del dominio.

Un solo validatore tabellare condiviso con CSV: preview e conferma, motivo,
versione, permessi, riferimenti, audit e baseline preesistenti. Nessun nuovo
endpoint, schema DB, mapping automatico del cliente o programma importato da XLSX.
[Contratto, limiti e formati](../asset-xlsx-import.md).

File oltre8MB, espansione oltre16MB/parte o32MB totali, troppi nodi/parti/righe/colonne,
formule/cache, DTD/entity, macro/embedded, link e connessioni esterne sono respinti.
La decompressione controlla anche i byte effettivi. Si seguono le relazioni attive
del pacchetto; le parti orfane non sostituiscono stringhe o stili referenziati.
Non viene dichiarata una validazione completa OOXML o CRC del pacchetto ZIP.

Dipendenze fissate: **fflate0.8.3** e **fast-xml-parser5.12.0**, MIT, da registro
npm pubblico;9 nuove voci nel lockfile, nessuna versione esistente cambiata.
Script di installazione disattivati, nessun install globale/spesa/servizio.
Verificati metadata/versioni correnti e documentazione primaria:
[fflate](https://github.com/101arrowz/fflate),
[fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser),
[OpenXML shared strings](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/working-with-the-shared-string-table).

## Dashboard

Riepilogo unico con stati compatti; overdue, blocker, retest e assegnazioni subito
dopo. Tag per livello con righe e percentuali, senza anelli. Matrici, analisi per
fase/costruzione, priorità issue, trend e setup sono accessibili con disclosure
native. Metriche, formule, filtri, drilldown, ruoli e accesso progetto sono quelli
precedenti. Nessun rating Health o nuovo criterio On/At/Off Track.

Ownership: subagente riusato `/root/nov5_scope_audit` ha modificato solo Overview;
root ha implementato import, template, wiring e integrazione. Revisione indipendente
XLSX: corretti relazioni attive/orfane, escape SpreadsheetML a passaggio singolo
con prefisso minuscolo e stili solo orario. Regressioni dedicate passate; nessun
altro finding confermato. Nessun modello/effort o consumo figlio inventato.

## Prove

- **56/56 test mirati**: asset-xlsx, asset-transfer, programme-identifiers,
  commissioning, asset-register e dashboard-progress. **11 nuovi casi XLSX**, inclusi
  10.000asset validi, dimensione ZIP falsificata respinta, semantica dei vuoti,
  ID/escape, relazioni orfane, bool/date, formule/link/macro/DTD e limiti.
- Typecheck, lint dei file modificati, formato e build finale Next passati.
  CLI detector Impeccable terminata con esito0, senza output; nessun ignore aggiunto.
- Template letto indipendentemente con openpyxl: un foglio,19 header, zero righe
  dati e stile colonne testo. Il controllo download è visibile nel browser;
  nessuna nuova prova di download completato attribuita a questo lotto.
- Browser1440×1000 e390×844, demo sintetica isolata: riepilogo120 attività e
  drilldown120; blocker11 e relativo filtro11. Disclosure programma apribile.
  Progetto vuoto mostra percorso Assets→Programme→Tasks senza dati dell'altro progetto.
- File sintetico XLSX: anteprima con1asset aggiunto, motivo/conferma, salvataggio
  e presenza dopo reload;28→29asset,100attività programma conservate, revisione1→2.
  Il nuovo obbligo tag resta privo di approvazione, senza risultati dedotti dal test.
- Mobile senza overflow orizzontale; nessun errore console osservato. Tab temporaneo
  chiuso, viewport ripristinato e server terminato. next-env.d.ts ripristinato
  byte per byte al contenuto pre-build, comprese le modifiche preesistenti.

Screenshot sintetici privati in `output/playwright/nov5-xlsx/`:
`overview-desktop.png`, `overview-mobile.png`, `xlsx-preview-mobile.png`.
Fixture e originali restano fuori Git. Solo demo con URL DB vuoti, DEMO_MODE=true,
COPILOT_ENABLED=false e credenziali/provider vuoti; nessun import reale, DB remoto
o AI live. Le vecchie115 prove/10 API non sono state presentate come nuovi test.

## Rilievo sicurezza delle dipendenze preesistenti

`npm audit --omit=dev` al5nov: nessuna segnalazione sulle9 nuove voci. Riporta
però **1critical e3high** su dipendenze già nel lockfile: Next16.3.5, sharp0.35.4,
source-map-js1.2.1 e Zod4.6.2. Le versioni non sono state cambiate da questo lotto.
L'audit non prova sfruttabilità nell'app; resta un intervento tecnico da chiudere
prima di una pubblicazione. Il ramo non usa ImageResponse o funzioni `use cache`
individuate dalla ricerca statica, senza dedurne immunità complessiva.

Fonti vendor per Next:
[ImageResponse](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j),
[typed arrays/use cache](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr).
Nessun `audit fix` o aggiornamento ampio introdotto come effetto collaterale.

## Stato operativo

Fetch origin riuscito prima degli edit: main14 avanti e0 indietro, checkout
modificato preservato senza pull/reset/stash/force. Commit applicativo locale14692f6;
report/stato salvati separatamente. Nessun push/deploy o modifica a richieste,
eventi, ACL o callback della regia. Correlazione unica del monitor riusata.

Quota conto nativa56% all'avvio e60% alla chiusura, checkpoint60 con uso ordinario consentito.
Valori globali, non consuntivo attribuibile a questo job; token job **null**,
nessun reset/acquisto/credito aggiuntivo. La bozza locale precedente che diceva
«XLSX pending» è superata e non approvata; hash/originale conservati, nessun invio.
