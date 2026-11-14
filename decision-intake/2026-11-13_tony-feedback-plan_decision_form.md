# FieldTrack — decisioni per il piano feedback Tony

Creato il 13 novembre 2026; aggiornato il 14 novembre 2026.
Stato: decisioni business acquisite, implementazione e collaudo locale conclusi.
Nessuna scadenza concordata. La visita riferita del 17 novembre non è una deadline.

Il mandato iniziale di sola pianificazione è storico. Nella stessa chat Marco ha
poi richiesto: «fai tutto quello che tony ha chiesto e committa via via se hai dubbi
fammi domande poi voglio che implementi tutte le richieste». Il mandato comprende
R2–R5 del [piano](../docs/tony-feedback/intake-20261113-feedback-plan.md), dopo R1 UI
consegnato. [Implementazione, decisioni e prove](../docs/tony-feedback/intake-20261114-assistant-extension.md).
Le risposte sotto sono dirette di Marco, non dedotte dalle annotazioni di Tony.

## Decisioni business approvate il 14 novembre

| ID  | Decisione diretta                                                                                       | Stato    | Conseguenza implementata                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F04 | «Solo fornitore equipment»                                                                              | approved | Asset.vendor esplicito, import/export/edit; nessuna equivalenza con owner, manufacturer o support contractor. Report e lookahead usano questo campo.                                                                                                                 |
| F01 | «Sì: 60% dai passi, colori come indicato»; conferma dell'esempio 6/10 anche con approvazione in attesa. | approved | Passi obbligatori applicabili superati / obbligatori applicabili. N/A espliciti esclusi; firme/review separate. Precedenza rosso late, poi arancio completato con Works to go aperti, poi verde completato puntuale. Non ancora dovuto neutro; sconosciuto distinto. |
| F03 | «Admin e manager confermano le proprie proposte»                                                        | approved | Preview supervisor; conferma admin/manager del proprio draft esatto, legato a sessione/versione/hash. Nessuna scrittura autonoma del modello o approvazione di altri utenti.                                                                                         |

Fonte: risposte strutturate alla domanda call_58b3b6b41f7b4937b24b21d743dc29aa e
conferma percentuale call_3608df0e6ef1498e9097dd00ad950578 nella chat esecutiva.
Owner decisioni: Marco. Registrazione/implementazione: Codex. Deadline: null.

## Scelte di attuazione e limiti

| ID  | Esito                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F02 | Mandato R4 eseguito anche sugli ID reali LHR11: working overlay versionato, date e relazioni esplicite, nuove attività collegate a task/asset nello stesso Schedule. Prova offline 16.969 attività/36.923 relazioni/13 calendari. Nessun ricalcolo automatico delle date a valle o conversione P6 integrale. |
| F14 | Lessons curate e versionate, collegate alla fonte e visibili nel progetto già autorizzato. Admin/manager salvano esplicitamente, supervisor legge. Attuazione conservativa del mandato R5: nessuna promozione automatica di note o ampliamento ACL.                                                          |
| F16 | Nessuna deadline o impegno demo del 17 novembre acquisiti. Non blocca il mandato esecutivo del 14 novembre.                                                                                                                                                                                                  |

## Controlli tecnici Codex

Non sono ulteriori richieste di approvazione umana.

| ID  | Controllo verificato                                                                                                                | Prova/consegna                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| F05 | WTG da record reali; disciplina esplicita/da link non ambigui, conflitti e assenti separati.                                        | 21 test report + API                                 |
| F06 | Oggi…oggi+13 inclusivi, Europe/Amsterdam, ongoing sovrapposte incluse, overdue e senza data separati; solo forecast salvato.        | Test report/API, finestra fissata anche nel link     |
| F07 | Ore sorgente conservate; giorni soltanto da calendario/unità attestati, toggle durata.                                              | R1 UI già consegnato, prova P6 invariato             |
| F08 | Nome primario, riferimenti leggibili FT-00001 e ID stabili; righe vocali da snapshot filtri/versione.                               | Test snapshot e collisioni codici + browser          |
| F09 | Copia della sola applicabilità tag con target/diff; mai esiti, firme o evidenze.                                                    | R1 UI + test esistenti                               |
| F10 | Clone con nuove identità senza attestazioni/link ereditati.                                                                         | R1 UI + test clone/API                               |
| F11 | Delete/restore proteggono task, figli, checksheet, WTG, storia, nuovi mapping working e fonti lesson.                               | Test dominio/PostgreSQL/API                          |
| F12 | Whitelist CSV/JSON/XLSX, validazione parser e limiti aggiornati col campo supplier. Nessuna promessa di tutti i formati universali. | 27 test supplier/transfer/XLSX                       |
| F13 | ACL prima di totali/facet/snippet; membership/moduli freschi, identità composta; nessuna condivisione globale.                      | Library 8 test + API/revoca                          |
| F15 | Schedule, Project assistant, report sotto Overview e Overdue integrato con link compatibili.                                        | R1 UI già pubblicato, verifica finale desktop/mobile |

Nessuna nuova approvazione per provider/chiave: setup e attivazione del 10 novembre
restano invariati; il collaudo corrente non effettua chiamate AI live o a pagamento.
Nessuna scrittura DB remota, migrazione amministrativa, invio esterno o nuovo budget.
Originali e ricevute restano privati fuori Git; storico precedente conservato in Git.
