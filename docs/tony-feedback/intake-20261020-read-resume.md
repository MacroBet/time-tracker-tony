# Tony — lettura manuale del20ott2026

## Mandato e prova diretta

Marco ha chiesto di sbloccare Tony leggendo WhatsApp. Fonte umana verificata via
read_thread: regia `01a1493a-ee0b-7d62-a861-d8d546bf013c`, messaggio
`01a15849-487f-7000-802e-c936abea0808`. Il nuovo mandato supera per questa unità
il precedente limite di acquisizione invariata; autorizza lettura e confronto,
non sviluppo, invio, provider o scritture DB. Correlazione esistente
`tony-new-whatsapp-feedback-20261017`; riuso/fallback terminale spetta al publisher.
Eventuale fallback indicato dalla regia: `tony-whatsapp-read-resume-20261020` /
`tony-whatsapp-read-resume-request-20261020`, scadenza20ott. Nessuna creazione
request/evento o callback eseguita da questo owner.

App nativa macOS accessibile tramite CUA già consentito; identità verificata da
chat individuale selezionata e intestazione Tony McIntyre. Non attestato un ID
univoco account/contatto. Nessuna modifica di permessi, firme, certificati o trust.
La prova UI è distinta dal lettore Go: non ne dimostra implementazione o firma.

## Copertura nuova

Sovrapposizione visiva all’outgoing17ott21:26; dopo il separatore19ott:
**4 elementi testuali:1 didascalia album10:48 e3 messaggi autonomi10:49/20:53/20:53**.
Il precedente aggiornamento parlava genericamente di quattro messaggi: questo è
il conteggio distinto. Ultima bolla visibile19ott20:53, nessuna successiva visibile.
Date da UI e timestamp album, contesto Europe/Rome. Non attestata tutta la
cronologia precedente; gap storici invariati.

L’albero AX della chat omette i tre testi più recenti; questi sono stati letti
nello screenshot del fondo. Album identificato via AX e aperto nel viewer:
**10/10 foto lette visivamente**, posizioni32–41di41, tutte19ott10:48.
Una freccia tastiera iniziale non avanzava: selezione tramite miniature osservate,
con posizione AX verificata a ogni passaggio. Chiuso il viewer a fine lettura.
Nessun originale scaricato, hash originale non disponibile; i29originali
precedentemente verificati restano29. Testi privati nel solo file ignorato Git
`output/tony/read-resume-20261020.private.json`; nessuna cattura UI salvata nel repo.
Audio esclusi; nessun testo digitato nel composer, bozza inserita o invio.

## Cosa mostrano le foto

Le foto sono report di un sistema di terzi, non schermate operative di FieldTrack.
I titoli descrittivi di alcuni tool erano ipotesi prima della cattura: l’analisi
qui segue il contenuto effettivamente osservato.

| Foto nell’album | Contenuto letto                                                                                                                                                                       | Limite                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1–2             | Flat table asset/tag con baseline, achieved, forecast, stato/puntualità; filtri gerarchia progetto, team, tipo tag, Phase, disciplina/sistema e owner; barre ritardo/puntualità e tag | Due viste con selezioni diverse; numeri del riferimento, non dati FieldTrack                   |
| 3               | Riepilogo Red/Yellow/Green/Blue con passed/in progress/not started e milestone L2/L3/L4/L5                                                                                            | Colori specifici del riferimento, nessuna equivalenza globale dedotta                          |
| 4               | S-curve settimanale planned/forecast/achieved con tabella per data/tag                                                                                                                | Formule e calcolo non visibili, non dedotti                                                    |
| 5               | Gantt progetto→tag, date, percentuali actual, linea today, espandi/comprimi e tabella sottostante                                                                                     | Non prova editing, dipendenze o motore di ripianificazione                                     |
| 6–7             | Vincoli per categoria/disciplina/vendor/sistema, elenco gerarchico per owner e asset                                                                                                  | Stesso report da due inquadrature; semantica vincoli non equiparata automaticamente alle issue |
| 8               | Issue open/closed, media giorni aperti, tipo, assegnatario, root cause e mese creazione                                                                                               | Valori del riferimento; nessuna regola automatica approvata                                    |
| 9               | Flat table filtrata Phase2 con date/stato/puntualità e barre tag                                                                                                                      | Non una checklist dettagliata nonostante il nome del tool di cattura                           |
| 10              | Power/Cooling String: planned/achieved/forecast, varianza e pivot progetto→tag→asset                                                                                                  | Non una master checklist; metrica/aggregazioni non specificate                                 |

## Richieste rispetto al consegnato

Parafrasi del contenuto pertinente, senza trascrizione privata in Git.

| Richiesta/indicazione                                                 | Già presente verificabile                                                                                                      | Mancante o da decidere                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Schede semplici con prove allegate, richiamo a un precedente prodotto | Tasks e test sheet per tag con file collegati all’attività, risultato/observations e review separata                           | Non abbiamo esaminato il precedente prodotto: nessuna equivalenza UX esatta attestata; eventuale semplificazione va delimitata  |
| Prova del lavoro su task o passi QA/QC                                | Allegati a task/tag, upload/download autenticati e audit                                                                       | Checklist con più passi e prova legata al singolo passo non consegnata; campi, esiti/firme, versioni e regole issue da definire |
| Soluzione di archiviazione                                            | MVP attuale nel DB: dati base64; PNG/JPEG/WebP/PDF,2MB/file,20file/attività; task chiusa da riaprire prima di aggiungere prove | Object storage per scala, volumi/tipi/conservazione, permessi, costi e migrazione da concordare; nessun servizio attivato       |
| Sistema mostrato debole sulla pianificazione; foto come riferimento   | Gantt persistente e baseline/forecast, asset/tag/issue, filtri Area/Phase e dashboard esistenti                                | Nessun mandato a copiare ogni report o dedurre formule/S-curve/vincoli; Project Health storico resta senza formula concordata   |
| Catalogo documenti manuale precedente                                 | 5cd5ca9 locale: required/optional per progetto/Phase/livello, visibile nei tag                                                 | Non è stato pubblicato da questo ciclo; template riusabili e prova per singolo passo restano fuori                              |

Riscontro statico20ott: `src/app/components/TaskDetail.tsx` sezione Evidence,
`src/server/handlers.ts` uploadAttachment/getAttachment e
`src/server/db/schema.ts` tabella attachments. Non è un test autenticato di
produzione né una nuova suite: nessun codice cambiato, test app non ripetuti.
HEAD locale osservato `017d096`,8commit avanti alla ref origin/main in cache;
fetch tentato come richiesto ma SSH ha risposto Permission denied(publickey).
Nessun reset/stash/pull/push, modifica credenziali o deploy. Preservati file già
modificati, lavoro AI indipendente e next-env.d.ts preesistente.

## Esito e prossimo passo

Lettura richiesta completata; **nessun blocco UI o gesto fisico richiesto a Marco**.
Il publisher può riconciliare l’incarico usando il report metadata aggiornato.
Lavoro prodotto successivo da delimitare: prova per singolo passo QA/QC e piano
storage, mantenendo la semplicità delle schede. Nessun lotto avviato solo dalle
fonti. Nessuna nuova domanda credenziali o bozza cliente necessaria per la lettura.
Bozza18ott approvata resta con invio differito, non reinviata.
Nessun nuovo heartbeat/loop o acquisizione ripetuta a stato invariato.
