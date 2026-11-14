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
2. Report condivisi UI/AI e stato filtri della conversazione: in implementazione.
3. Schedule di lavoro versionato e proposte confermabili: in implementazione.
4. Biblioteca consentita e lessons curate: in implementazione.
5. Collaudo integrato, pubblicazione e prove finali: da eseguire.

Baseline main `49dab18`, fetch riuscito, nessun pull/reset/stash. Preesistenti
preservati: manifest/index/P6-parity/regia-status/register, readiness non tracciato,
next-env.d.ts (backup privato /tmp/fieldtrack-assistant-next-env-before.d.ts).
Quota nativa iniziale 18%, ordinaryUsageAllowed=true; cap90/stop nuovi85 invariati.
Originali, dati di prova e log rimangono privati in output/tony/assistant-extension-20261114/.
