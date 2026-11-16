# Attuazione del piano Tony — 16 novembre 2026

## Mandato e limiti correnti

Marco ha approvato l'intero piano A1–A8, delega parallela e commit progressivi,
nel messaggio umano `01a1e5cb-1f3d-7ba3-8e22-e8a011404eb3` della regia,
turno `01a1e5cb-1cbf-7ae3-a539-239a95baed33`. Job manuale
`tony-plan-implementation-20261116`, richiesta
`tony-plan-implementation-request-20261116`, deadline non concordata.

Dashboard: approvati default condivisi di progetto e preferenze personali
separate, usando i KPI esistenti. Le sei/sette colonne sono un'ipotesi operativa
del piano. Marco chiarisce che oggi non sono arrivati messaggi vocali: la traccia
AAC interna al video rimane non trascritta, senza costituire un blocco o una nuova
richiesta di analisi audio. Le immagini e il video già esaminati sono ricondotti
alla [matrice dei requisiti](intake-20261116-complete-analysis-plan.md);
nessuna riacquisizione a stato invariato.

Lavoro corrente: implementazione, test isolati e commit locali. L'estensione a
push/deploy remoti è stata rifiutata dalla revisione automatica nella regia prima
di arrivare all'esecutore: il rilascio richiede approvazione specifica sul risultato
concreto. Nessun consenso storico viene riutilizzato per aggirare questo limite.
Nessun DB remoto/import reale, provider o API a pagamento, nuovo segreto o servizio,
invio cliente o Autopilot. La criticità P6 salvata precede l'eventuale motore CPM
di lavoro, che rimane un incremento condizionato al proprio contratto.

## Monitor fermato

Unica verifica conclusiva CUA, senza focus/composer/invio: anteprima uscente Tony
con il testo esatto indicato da Marco, ore19:49 Europe/Rome. La regia ha impostato
nativamente l'automazione unica `agente-progetto-tony` su **PAUSED**, confermata
anche dal file di configurazione. Nessun'altra lettura WhatsApp o processo di
monitoraggio. La copertura acquisita dei messaggi rimane16nov19:22:53; la sola
anteprima uscente non attesta lettura di altri ingressi.

## Esecuzione e ownership

| Lotto | Esecutore | Ambito esclusivo iniziale | Stato |
| --- | --- | --- | --- |
| A1 | implement_a1 | Backend Copilot/report, trasporto, letture deterministiche dichiarate | In corso, test locali |
| A2 | implement_a2 | Progetto/create/rename/API/Admin; sezioni repository concordate | In corso, test locali |
| A3 e Schedule A5 | implement_a3 | Gantt, asse, colonne, reducer e comandi di vista | In corso, test locali |
| A4–A8, integrazione | root | Dashboard/preferenze, popup assistente, Tasks, comandi/voce, criticità P6 | In corso |

Un solo writer per file; nessun subagente esegue commit/push. Root verifica e
committa i lotti. Checkout iniziale `edfe356`, un commit locale sopra origin/main;
fetch già riuscito, nessun pull necessario su checkout con modifiche. Cambi
preesistenti e `next-env.d.ts` preservati. Originali e prove private sotto
`output/tony/implementation-20261116/`, fuoriGit. Quota iniziale conto46%, uso
ordinario consentito; cap90%, stop nuovi lotti85%, riserva di chiusura5 punti.

## Prove e consegna

A1: i due testi osservati usano report/ricerca sui dati salvati con provenienza
esplicita, zero chiamate provider e stesso insieme/link dei report completi.
Domande ambigue o composte rimangono al provider configurato. Cancellazione e
metering terminale preservati, errori ACL/conflitto conservati, controllo finale
sessione/versione/moduli. Timeout20s invariato, nessun retry pagato automatico.

Profilo offline dichiarato:12prove prima/dopo su16.969righe P6 e1.354asset
sintetici, senza DB/rete/provider. Lookahead CPU p50/p95 da265/365ms a138/195ms;
search dopo4,5/13,9ms; cold parse/index≈418ms. Non prova la causa storica né
una latenza produzione.55test mirati più23dopo i guard finali PASS;1test API
isolato con61righe oltre pagina50 PASS (totali, filtri, unknown/zero, ACL,
revoca, scoping, nessuna proposta). Typecheck e lint mirati PASS.

Gli altri lotti rimangono in corso. Matrice e verifiche finali da completare;
nessuna pubblicazione o collaudo del provider live attestati.

A2 backend: creazione atomica con membership e request ID stabile, rinomina del
solo nome FieldTrack con CAS e audit; fonte P6, task, asset e versione commissioning
preservati. Il retry già consumato restituisce il profilo corrente, anche dopo
A→B→A, senza annullare rinomine successive o aggiungere audit duplicato.3test
PostgreSQL/dominio e1API demo PASS, inclusi revoca, conflitti e fixture XER
sintetica nel nuovo target. La UI passa alla verifica centrale; nessun import reale.

A3/A8: apertura/reset su Today nel calendario del progetto, input/righello/pan
concordanti; controlli durata stabili, date opzionali, scale DAY/WK/MTH e finestre
2/4/6WK indipendenti dai filtri dei report. Comandi display tipizzati con scope,
versione e ACK della vista montata. Percentuali passi F01 separate dalla criticità.
Criticità: solo criterio P6 salvato CT_TotFloat e relativa soglia in ore; sul file
già custodito639critical/4.703non-critical/11.627unknown. Fonte immutata; modifiche
working a date/link dichiarano stale, senza CPM o ricalcolo nascosto.

QA centrale ha scoperto e corretto un parametro `critical` omesso nell'endpoint
`schedule-working`: regressione prima61anziché1, poi API working/source con filtri,
paging e invalid400 PASS e UI sullo stesso target locale1–1di1. Criterio/copertura/
stale sono visibili in Info. Durata Days→Hidden conserva x/y del controllo e data;
hide date/reset e cambio scala/finestra verificati nella UI locale. Test dominio
mirati e API A8 PASS. La suite generale dell'albero integrato ha334test PASS,
lint e typecheck PASS prima degli ultimi fix, seguiti dai relativi test mirati.
Nessun confronto di latenza o altezza in produzione dichiarato.
