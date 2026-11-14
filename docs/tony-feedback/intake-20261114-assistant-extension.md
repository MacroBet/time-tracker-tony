# FieldTrack - estensione assistente e richieste residue Tony, 14 novembre 2026

## Mandato e decisioni dirette

Marco richiede di implementare tutte le richieste Tony residue, fare domande sui
punti dubbi e committare progressivamente. Il mandato esecutivo supera il limite
in_review del piano del 13 novembre per R2-R5. Nessun nuovo invio esterno, segreto,
spesa o SQL amministrativo; il collaudo resta demo locale isolata, senza AI live.

Risposte dirette di Marco in questa chat:

- F04: vendor = **solo fornitore equipment**. Campo esplicito, distinto da owner,
  fabbricante o azienda dell'assegnatario; nessun backfill inferito.
- F01: 10 passi obbligatori applicabili, 6 superati = **60%**, anche in attesa di
  approvazione del tag. Firme/review separate. Rosso se late, poi arancio se
  completato con Works to go aperti, verde completato puntualmente; nessun colore
  se non ancora dovuto. Sconosciuto/senza mapping distinto da zero o puntuale.
- F03: **admin e manager confermano le proprie proposte**, supervisor proponente.
  Nessuna approvazione tra utenti implicita o scrittura autonoma del modello.

Casi di accettazione dal testo Tony fornito da Marco: report tagging di progetto;
filtri cumulativi vendor/livello/late e accesso diretto al vendor; Works to go per
vendor/discipline; attività nei successivi 14 giorni; fornitori equipment necessari
nella stessa finestra; nuova attività per asset con deadline visibile nello stesso
Schedule. Il piano residuo include mutazioni sulle attività LHR11 esistenti,
predecessori/successori multipli, percentuale/semaforo e biblioteca tra progetti.

## Incrementi e prove

1. Fornitore equipment esplicito nell'asset: edit/dettaglio, CSV/JSON/XLSX,
   conservazione negli import precedenti e duplicazione della sola anagrafica.
   Campo assente non inferito da owner; vuoto esplicito cancellabile. Template e
   limite colonne XLSX aggiornati insieme. 27 test supplier/transfer/XLSX passati.
2. Report condivisi UI/AI implementati: tagging per supplier/livello/late,
   Works to go reali per supplier/discipline, lookahead oggi…oggi+13 inclusivi
   (Europe/Amsterdam) e fornitori equipment della stessa finestra. Filtri
   cumulativi nella conversazione, reset/clear espliciti, totali prima del paging
   ed export CSV dell'intero insieme filtrato. Mapping mancanti/conflittuali e
   attività senza date separati. La percentuale considera solo livelli richiesti
   attivi e passi obbligatori applicabili; schede senza tag e storia disabilitata
   conservate ma escluse. Approvazioni/firme distinte. Il Gantt apre esattamente
   lo stesso perimetro attività/asset/livello del report. 21 test report dedicati.
3. Schedule di lavoro versionato implementato sullo stesso grafo P6 indicizzato,
   con date esplicite, mapping equipment e predecessori/successori multipli.
   Anteprima firmata con attore/sessione/versione/hash, conferma del solo autore
   admin/manager, supervisor solo preview. Cicli, ID mancanti, sorgenti/versioni
   stale e rimozioni di relazioni estranee rifiutati. Una nuova attività per asset
   crea atomicamente un task non assegnato e una riga nello stesso working Gantt,
   con riferimento leggibile FT-00001 e ricevuta idempotente. Start mancante resta
   sconosciuto. Gli ID di righe vocali si risolvono soltanto sullo snapshot dei
   filtri/versione visibili, mai usati come ID sorgente. P6 originale intatto;
   nessun ricalcolo automatico delle date a valle promesso o eseguito.
4. Biblioteca consentita e lessons curate implementate: ricerca cross-project con
   ACL prima di risultati/facet/snippet, identita composta, salvataggio/edit
   espliciti con autore/provenienza/versione, pagina /library. 8 test dedicati;
   bootstrap non espone lesson o revisioni di lavoro ai worker. Cancellazione e
   restore asset proteggono anche link working/lesson (2 test, incluso PostgreSQL).
   Collaudo API integrato superato, inclusi CAS e revoca permessi su sessione viva.
5. Assistente esteso con cinque tool strutturati oltre ai sette esistenti:
   project_report, search_schedule_activities, propose_asset_activity,
   propose_schedule_edit, search_project_library. Ogni tool rilegge autorizzazioni
   correnti; risultati/cache client invalidati al cambio progetto/accessi. Il
   modello produce bozze e non riceve token di conferma. Date ambigue come Friday
   23rd richiedono mese/anno/giorno coerenti, nessuna data inventata. Provider,
   configurazione e limiti Responses esistenti conservati; nessuna chiamata live.

## Collaudo e limiti della consegna

- 253 test unitari/PostgreSQL e 15 test API passati su demo locale isolata;
  lint, typecheck, build produzione e formattazione verificati. Test tool-loop con
  trasporto sintetico iniettato, nessun uso del provider reale o costo API.
- Due soli lotti visivi: prima passata e conferma dopo una correzione circoscritta.
  Conferma finale 28 schermate (14 stati x desktop/mobile), zero errori runtime,
  overflow pagina, controlli visibili sotto 44px o privi di etichetta rilevati.
  Pannelli risultato AI verificati con intercettazione UI sintetica dichiarata,
  separata dai dati/demo realmente salvati e dalle prove del tool-loop.
- Prova offline sul P6 LHR11 reale: 16.969 attività, 36.923 relazioni, 13 calendari;
  una sola attività modificata esplicitamente, 35 discendenti esaminati. Sorgente,
  relazioni/tipi/lag, calendari/durate e date delle altre attività invariati.
- Il feedback è accessibile da sidebar/More e restituisce il focus al trigger:
  rimosso l'overlay mobile/desktop che copriva campi nelle nuove schermate.
- Supplier/mapping/checksheet mancanti sui dati reali restano da registrare:
  la consegna non li inventa. Lookahead è la previsione salvata, non una predizione
  AI né una prenotazione/disponibilità dei fornitori. Nessuna scrittura DB remota,
  migrazione, nuovo segreto, invio esterno o test AI a pagamento.

Prove browser di salvataggio: creazione confermata di una sola attività/task nello
stesso progetto P6, riferimento leggibile e collegamento persistenti; salvataggio e
modifica lesson con versione, filtri cumulativi/reset/cambio progetto, snapshot
working/original e link assistente, deep link Works to go e ritorno del focus
feedback desktop/mobile. Due selettori e l'attesa autofocus del test sono stati
corretti nel solo harness, senza mutazioni aggiuntive o nuove passate di polish.

## Pubblicazione e chiusura

Commit progressivi `0f556cc`, `3719727`, `d9279ac`, push normale su main.
Vercel Production **7791208123** success il 14 novembre 2026 alle 17:32:32 UTC,
SHA esatto `d9279acec19a01f849b3ecfe78468812e29f776c`; status GitHub Vercel success
e alias pubblico https://time-tracker-tony.vercel.app HTTP200 verificati.
Collaudo autenticato e salvataggi soltanto locali; nessun accesso o dato cliente
modificato dalla verifica pubblica. Ricevuta privata release-code.private.json.

Registro/form/PRODUCT aggiornati; server e browser di prova chiusi. Next-env e
modifiche preesistenti preservati. Quota conto 18% iniziale, 20% alla chiusura,
ordinaryUsageAllowed=true; cap90/stop nuovi85 invariati, nessun reset/acquisto.
Nessuna decisione business residua bloccante per questo mandato. Prossimo passo:
uso con supplier/mapping realmente registrati e feedback umano; nessun nuovo lotto
autonomo, import remoto o test AI a pagamento implicito.

Baseline main `49dab18`, fetch riuscito, nessun pull/reset/stash. Preesistenti
preservati: manifest/index/P6-parity/regia-status/register, readiness non tracciato,
next-env.d.ts (backup privato /tmp/fieldtrack-assistant-next-env-before.d.ts).
Quota nativa iniziale 18%, ordinaryUsageAllowed=true; cap90/stop nuovi85 invariati.
Originali, dati di prova e log rimangono privati in output/tony/assistant-extension-20261114/.

## PDF inglese aggiornato per Tony

Mandato successivo Marco: aggiornare il report PDF con tutte le nuove funzionalità
e come provarle, per inoltro manuale a Tony. Nuova edizione unificata di12pagine,
output/pdf/fieldtrack-product-update-test-guide-20261114-en.pdf (175207byte),
SHA2568eddd50be4a665e97e16647b9c3413b93d9002a4ccaac25b012476a8b518d720.
Include prima/dopo UI, prerequisiti supplier/mapping e ruoli, domande esempio,
passi manuali e risultati attesi per report/Gantt/WTG/lookahead/fornitori, creazione
attività e modifica P6, library/lesson, mobile e checklist. Limiti e prove locali
vs pubblicazione distinti; esempi sintetici etichettati, nessuna nuova provaAI live.
Fonte release3917024 verificata nel lavoro precedente. PDF precedente conservato.
Render12/12pagine ispezionato; estrazione, link live e margini verificati. Nessun
invio aTony, cambio applicativo, deploy o scrittura dati remota per questo incarico.
PDF/generatore/ricevute privati fuoriGit; registro aggiornato con patch selettiva.
