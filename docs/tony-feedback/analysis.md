# Prima analisi — 15 ottobre 2026

Fotografia storica: per consegne e decisioni successive usare lo
[stato corrente](register.md#stato-corrente-per-ripresa). Marco ha poi scelto
il programma autorevole dentro l’app, P6 solo riferimento e ripresa manuale.

## Ultimi messaggi: cosa vuole Tony

Alle **19:01** Tony chiarisce che il punto principale è un **Gantt simile a
Microsoft Project per governare il programma** (MSG-20261015-07). Alle **18:57**
chiede anche tabella asset, import/export e storico completo con gli ultimi tre
eventi in evidenza (MSG-20261015-05). Sono richieste esplicite. Non è definito se
il programma autorevole debba vivere nell'app o in P6.

## ZIP più recente — ATT-010, 18:56

`attachments/2026-10-15_1856_cx-planner01-project-configuration.zip`: 45.024 byte,
22 file. Ispezione statica delle voci ZIP senza installare o eseguire nulla e senza
estrarre nel codice applicativo. Letti inventario, README, package, schema SQL,
sezioni pertinenti di app/page.tsx e API tasks. Altre API solo inventariate.

| Parte                 | Riscontro verificato nel sorgente                                                                                                                      | Implicazione                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Stack                 | Next 14.2.15, React 18.3.1; Supabase, QStash e SDK OpenAI                                                                                              | Progetto separato dall'app corrente Next 16 / React 19 / Neon-Drizzle              |
| Struttura             | app/page.tsx, layout/CSS, API tasks/events/sync/queue/webhook/health, lib, schema SQL e configurazione Vercel                                          | UI più predisposizioni backend; non è solo un'immagine                             |
| Project Configuration | app/page.tsx righe 54–61: Project ID, Schedule ID, nome, cliente, sito, baseline e stato; save usa setProjects/useState                                | Progetti aggiunti soltanto nella sessione React, senza salvataggio remoto dalla UI |
| Gantt                 | Righe 92–129: durata, inizio/fine, predecessori/successori e barre su 12 mesi                                                                          | Riferimento visivo già presente                                                    |
| Dati Gantt            | Righe 95–102: dipendenze fissate nel codice, posizioni iniziali predefinite, durata derivata dal progresso, date costruite sul 2025, massimo otto task | Non calcola un programma operativo dai dati reali                                  |
| Limiti Gantt          | Riga 128 dice che scheduling reale, lag/lead, vincoli e critical path vanno collegati a dati persistenti                                               | L'aspetto MS Project non prova la funzionalità di pianificazione                   |
| Registro tag          | Record demo con gerarchia, disciplina, parent, path A/B, energised e stato commissioning                                                               | Utile come riferimento, tassonomia da riconciliare                                 |
| Export registro       | Riga 190 mostra un avviso per abilitarlo tramite API                                                                                                   | Pulsante segnaposto, non export reale                                              |
| Collegamento UI/API   | Nessuna chiamata fetch e nessun localStorage in app/page.tsx; stato modificato via React                                                               | Le API nel pacchetto non dimostrano che la UI le usi                               |
| Backend               | Schema per organizzazioni, membership, progetti, task/dipendenze, eventi/decisioni e integrazioni; API tasks GET/POST predisposta                      | Richiede provisioning e collaudo; nessun servizio contattato                       |

Il primo ZIP ATT-009 delle 15:19 contiene 21 file e la stessa base. Quello delle
18:56 amplia app/page.tsx/CSS e aggiunge tsconfig.tsbuildinfo; il package resta
versione 0.3.0. Entrambi i README richiedono credenziali/configurazione esterna.
Non sono state eseguite le loro istruzioni di deploy. Le indicazioni Connected/Live
e i numeri della dashboard sono dimostrativi, non prove di integrazione attiva.

## Excel e immagini

- **ATT-006, AMS16_Cx_Programme.xlsx:** inventariati 19 fogli presenti. Letti
  etichette/sezioni del foglio Status, intestazioni e formule delle prime 30 righe
  e riferimenti iniziali Cx Plan. Status A3:Y10 riassume per edificio, A12:O63
  per categoria asset; sezioni da A67 e A76 per fasi e metriche. Red/Yellow/
  Energisation/Green hanno Total/Actual/%. Compaiono pending, finish date, giorni
  lavorativi residui e ritmo richiesto. Non ricalcolato o certificato il workbook.
  Le formule usano wildcard sui nomi, date limite fisse e TODAY: non sono regole
  da copiare automaticamente nell'app. Colore, livello, completamento e approvazione
  non sono stati equiparati. Originale non risalvato.
- **ATT-007, ADD PROJECT.xlsx:** letti tutti i valori presenti in Sheet1 A1:Q22.
  Pannello fasi dinamiche, tipo progetto/nome, colori, matrice discipline e
  onsite/offsite, W1/W2/W3, QA/QC e livelli, import/export, località, potenza MW,
  amministratori. L21, i2/i3 da confermare. L5(IST) differisce da Equipment nel
  prototipo. Non renderizzato il layout Excel e non modificato il file.
- **ATT-001, team annotato:** ricerca team/azienda, aggiunta team, lista/pannelli,
  filtri persona/ruolo/task aperte e issue open-closed, progresso colorato per
  persona e amministratore per team. Quest'ultimo richiede regole sui permessi.
- **ATT-002, legenda mobile esterna:** grigio non iniziato, giallo in corso,
  arancione in corso in ritardo, rosso non iniziato in ritardo, verde completato;
  tratteggio sync required. Riferimento visivo, non prova di sincronizzazione.
- **ATT-003, dashboard annotata:** numeri vicini al grafico; lista Critical/P1–P5,
  colori coerenti, click sui pannelli per aprire liste. La schermata mostra asset
  e collegamenti mancanti: non autorizza a inventare avanzamento o dati.
- **ATT-004, closeout tracker esterno:** matrice asset/livelli, colonne nascondibili,
  stato critico, percentuali e issue; direzione visiva, non replica approvata di
  tutte le funzioni del prodotto esterno.
- **ATT-005, foto schema:** vista direttamente nella chat e salvata. Progress bar
  per fasi, cerchi per livello, area Client Supplied/OFCI e riduzione al 100%;
  legenda e sigle da confermare.
- **ATT-008, CX Planner Cloud:** screenshot con task, discipline, owner, milestones,
  health, trend e anteprime kanban/Gantt/calendario. Numeri e date non sono dati
  correnti verificati del progetto.

## Delta rispetto all'app all'inizio della sessione

Ispezionati Overview, CommissioningReport, CommissioningWorkspace, TeamPanel e
src/lib/commissioning.ts. Esistono già dashboard, cerchi cliccabili, priorità,
registro asset, import JSON con anteprima, report CSV e storico revisioni.

Mancano nel modello ispezionato: grafo predecessori/successori per ricalcolo Gantt,
attributo esplicito Client Supplied, stati documentali I/R/C/A distinti, W1/W2/W3
configurabili e storico completo degli eventi edit/upload/download. Il pannello
team ha filtro progetto e conteggi, non tutti i filtri annotati da Tony.

**Interpretazione da verificare:** riusare il prototipo per spiegare ed estendere
FieldTrack. Tony non ha chiesto esplicitamente di sostituire l'app o il backend.
Il deploy non è stato verificato. Le attività e i chiarimenti sono nel registro;
questa prima analisi precede il ciclo di implementazione autorizzato successivamente.

## Aggiornamento dopo l’implementazione del 15 ottobre

Le mancanze descritte sopra fotografano l’ispezione iniziale. Il ciclo successivo
ha aggiunto grafo FS persistente e Gantt, Client Supplied esplicito, review I/R/AC/A,
registro CSV/JSON e storico di progetto. W1/W2/W3 e la matrice discipline/onsite-offsite
restano da definire. ATT-011 è stato letto staticamente per asset/audit; ATT-012/013
come riferimenti visivi, senza copiare percentuali demo. Il [registro](register.md)
riporta il perimetro effettivo, test e commit. Nessuna migrazione Supabase o
esecuzione dei pacchetti ricevuti.
