# Confronto dati locali e produzione — 5 novembre 2026

Job `tony-production-data-reconciliation-20261105`, request
`tony-production-data-reconciliation-request-20261105`, owner Tony.
Mandato umano verificato nella regia, messaggio
`01a1ac28-a6f4-7940-b2e9-51d67dc38407`: analizzare il possibile vuoto in produzione
rispetto ai dati locali e le nuove informazioni di Tony. Nessun trasferimento
dati, query SQL remota, seed, nuova credenziale o invio cliente autorizzato.

## Causa verificata e limiti

**Il dataset Northbank del tour locale è sintetico, locale e mai trasferito in
produzione. Il push pubblica codice e funzioni, non i record della demo in memoria.**
Questo spiega la differenza rispetto a quella demo. La successiva osservazione
produzione della sessione Test admin mostra **305task esistenti, zero asset e zero
programma**. L’account di Tony resta non identificato; il database non è dichiarato
globalmente vuoto.
Nei nuovi messaggi letti Tony non afferma che la produzione sia vuota: questa
rimane l'osservazione/ipotesi di Marco da riconciliare con account e progetto.

| Perimetro                                     | Origine e contenuto verificati                                                                       | Limite                                                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tour/collaudi locali Northbank                | `createDemoData(..., {showcase:true})`, ID `p-demo-rich`: 28 asset, 100 attività programma, 120 task | Dati inventati e marcati SYNTHETIC, non derivati dagli allegati cliente. Un import sintetico QA aveva portato gli asset a29 nella sola sessione locale |
| Progetto locale vuoto                         | `p-demo-empty`: 0 asset, 0 programma, 0 task                                                         | Scenario esplicito di primo utilizzo, distinto da produzione                                                                                           |
| Altro progetto nella fixture locale           | `p1`: 3 asset, 2 attività programma, 10 task                                                         | Anche questo è fixture; il nome AMS16 non prova identità con un progetto remoto                                                                        |
| Sito pubblico                                 | Sessione anonima già verificata `mode: neon`, bootstrap401                                           | Indica configurazione e protezione; non inventaria record o membership                                                                                 |
| Precedente osservazione autenticata15ott      | Resoconto Marco: FieldTrack Test / AMS16 · Test, zero asset e programma,329 eventi                   | Storico, non inventario attuale né prova dell'account Tony; ID progetto e branch Neon non verificati                                                   |
| Produzione osservata5nov dal lettore delegato | Test admin, Admin, FieldTrack Test, unico progetto visibile AMS16 · Test:0asset,0programma e305task  | ID progetto osservato acquisito successivamente; account Tony non verificato, nessun inventario globale DB                                             |
| Account/progetto di Tony                      | Non confrontabile con la sessione osservata                                                          | ID, ruolo e membership di Tony e corrispondenza progetto non verificati                                                                                |

Prova offline nuova: sola esecuzione delle funzioni fixture/scoping, senza server o
DB. Manager/supervisor/admin sintetici vedono Northbank28/100/120; i worker vedono
soltanto asset/attività collegati al proprio lavoro assegnato. Questi numeri non
sono conteggi di Tony. Le prove browser/import precedenti restano quelle locali.

## Percorso dei dati e controllo dei filtri

- `src/server/config.ts`: DATABASE_URL seleziona Neon. La demo richiede assenza
  del DB e ambiente non Vercel; la build non popola né migra dati.
- `src/server/repository.ts`: demo in `globalThis.fieldtrackDemo`, azzerata al
  riavvio del processo. In Neon `loadData` legge solo progetti delle membership
  dell'utente; senza membership restituisce collezioni vuote. Admin non supera
  automaticamente questo confine. Un worker riceve solo il proprio lavoro e i
  relativi asset/attività; non è un filtro da disabilitare per far comparire dati.
- `AppContext.tsx`: Northbank è la selezione iniziale solo in demo. In Neon viene
  scelto il primo progetto assegnato; il selettore Project cambia contesto. Nessuna
  sincronizzazione fra localhost e dominio pubblico o fra account diversi.
- Assets inizializza ricerca vuota e Supply/Area/Phase su All; il componente ha
  una key per progetto che reinizializza i filtri. Anche Programme usa key progetto,
  ricerca vuota ed equipment non selezionato. Non è stato trovato un difetto che
  nasconda universalmente i dati a pagina appena aperta.
- Un file scelto passa da preview e conferma/motivo. Solo dopo viene salvato nello
  stato del progetto, in memoria per la demo o Neon per l'ambiente configurato.
  Acquisire un allegato in WhatsApp, analizzarlo o pubblicare il parser non lo importa.

Ipotesi ancora da discriminare per Tony: progetto senza asset/programma selezionato, account diverso o
membership mancante, ruolo worker senza assegnazioni, filtro applicato nella
sessione di Tony, dataset reale mai caricato o altro target DB. Nessuna è dichiarata
causa individuale verificata. Nell’account osservato l’assenza di asset/programma
è attestata, mentre305task sono presenti. Non sono state cambiate membership,
configurazioni o filtri remoti.

## Osservazione produzione delegata5nov

Il child reale `/root/tony_reply_reader` ha effettuato una normale apertura Chrome
verso l’alias, usando una sessione già autenticata, con sola lettura DOM/AX e
screenshot. Questa chat ha letto il suo rapporto privato, non direttamente l’app.
Profilo **Test admin · Admin**, workspace **FieldTrack Test**, unica opzione
progetto **AMS16 · Test**, ID DOM
`fcdb866f-12d4-4e85-a6b2-004ca1d53701`. Questo identifica il progetto osservato,
non lo approva come target del P6 o del nuovo exportACC. Assets mostra Start with your first
asset; Programme mostra Plan your first activity e Programme ID Not recorded.

Tasks: **305 totali =279unassigned+22assigned+0review+4closed**. Filtro corrente
Unassigned, ricerca vuota, Overdue only disattivato; pagina1–20 di279. Il279della
lista filtrata non è il totale progetto. Overview:4complete,272late,19blocked e
305senza link asset/schedule; i contatori late/blocked non vanno sommati come categorie
disgiunte. Origine dei305record non inventariata. Nessun banner Demo/Neon osservato;
la precedente sessione anonima indicava modeNeon separatamente.

Nessun login, cambio account/progetto/ruolo, import, export, API/SQL o altra
scrittura. Tab di osservazione non conservata, screenshot non persistiti. Rapporto
in `output/tony/data-reconciliation-20261105/production-ui-observation.private.md`.
Questa è una baseline UI limitata; non identifica Tony o il branch Neon e non è
uno snapshot completo su cui calcolare un merge. **I305task vanno preservati**, senza
cancellazioni, duplicazioni, rinomine o riassegnazioni dedotte da questa diagnosi.

La successiva osservazione People/Team mostra5persone, ricerca vuota e filtri
All supervised projects / All companies / All roles. Nessuna corrispondenza
Tony McIntyre/tonymcintyre nella sola vista: non prova assenza globale dell’account.
La regia ha già chiesto a Marco username/email usato da Tony, senza password;
risposta pending, nessuna nuova domanda duplicata qui.

## Rilascio verificato

La ricevuta pubblica GitHub/Vercel conservata conferma **9cd994bae740679e15161e95475e95afe747cb0f**,
Production **success**5nov12:09:14UTC, deployment GitHub **7573171129**,
[Vercel8PMSHyM9YYGAFEk3cs7eYW7fEMRK](https://vercel.com/macrobets-projects/time-tracker-tony/8PMSHyM9YYGAFEk3cs7eYW7fEMRK).
Il contenuto applicativo è invariato da90dd199. Il deploy è concluso e non viene
rifatto per affrontare un problema di disponibilità dei dati.

## Nuova copertura e richieste chiarite

Fonte delegata reale `/root/tony_reply_reader`, incaricata dalla regia: lettura CUA
circoscritta della chat Tony, sovrapposizione outgoing5nov12:40 fino incoming
**14:19 Europe/Rome**. Riporta **14 bolle incoming:12 testi e2XLSX con caption**,
nessun audio o invio. AX incompleto, testi letti da screenshot; screenshot originali
non persistiti dal lettore. Questa chat ha letto la trascrizione privata delegata,
non osservato direttamente WhatsApp. Originale e copia privata in
`output/tony/data-reconciliation-20261105/reply.private.md`; nessun testo grezzo in Git.

**Due XLSX soltanto censiti, zero acquisiti/letti.** L'acquisizione UI è fallita con
`noWindowsAvailable/frontmostApplicationChanged`, incluso un rebind circoscritto;
nessun nuovo tentativo da questa chat. Uno è un export asset ACC con nome uguale
a un originale precedente: l'identità binaria con ATT-014 non è verificata.
L'altro è un esempio di checksheet. I29originali WhatsApp e7mail acquisiti restano
invariati. Non si trasferiscono i conteggi del vecchio file al nuovo allegato.

| Chiarimento/richiesta5nov                                           | Già disponibile                                                                            | Conseguenza concreta e stato                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P6 già inviato contiene predecessori/successori                     | XER MAIL20-07 già letto:16969 attività,36923 relazioni, calendari e diversi tipi di legame | Non chiedere nuovamente le dipendenze. Resta conversione fedele: il motore corrente FS/lag nonnegativo/lun-ven non rappresenta tutti i legami e il limite15000 per richiesta è superato,2099durate sorgente sono zero e6attività superano100predecessori. Nessun import tronco, milestone convertita a un giorno o legame scartato |
| FR corrisponde a Phase nell'export asset ACC                        | Campo asset.phase già presente                                                             | Mapping semantico ora chiarito. Header, tipi, ID e contenuto del nuovo file restano da acquisire; Design phase del vecchio workbook non viene cancellata o equiparata automaticamente                                                                                                                                              |
| Colonna works to go e lista separata in dashboard quando richiesta  | Note, issue e liste di attenzione esistenti                                                | Campo/workflow dedicato assente. Registrato come nuova richiesta; non sostituito automaticamente con issue o overdue                                                                                                                                                                                                               |
| Firme specifiche per progetto e livello, modificabili dal team QA   | Review I/R/AC/A e catalogo richiesti/opzionali                                             | Modello firmatari configurabile non implementato. Le categorie indicate da Tony diventano riferimenti configurabili, non una lista globale rigida o nuove membership                                                                                                                                                               |
| Checksheet Excel con molte righe, risposte e firme                  | Task/tag, note/allegati e catalogo documentale                                             | Istanza multipasso/signoff non implementata; nuovo file non letto. Nessun esito o firma dedotto da un template                                                                                                                                                                                                                     |
| Aree governate dall'utente e associazione checksheet agli equipment | Metadati area e asset/tag già configurabili                                                | Conferma di configurabilità e associazione. Contratto template/istanza/versione e permessi QA da specificare usando il file; nessuna associazione automatica per somiglianza del nome                                                                                                                                              |

Le nuove risposte sono fonti per il backlog, non un nuovo mandato a sviluppare
queste feature o scrivere dati. Il presente incarico riguarda diagnosi e piano.

## Scelta umana fissata e anteprima reale parziale

Marco ha scelto esattamente **dati reali di Tony con anteprima dell’import**,
fonte nativa regia user `01a1ac30-4ac5-72e0-9929-d42c0b657888`. Scelta fissata:
nessuna demo online proposta come ramo attivo e nessuna nuova domanda su questo punto.
La scelta non autorizza seed, migrazione o scrittura remota.

Preparata un’anteprima offline revisionabile in
`output/tony/data-reconciliation-20261105/real-data-preview.private.md`, con
manifest `real-data-preview.private.json` e due inventari completi JSONL:

| Artefatto privato                          | Righe reali conservate | SHA256                                                           |
| ------------------------------------------ | ---------------------: | ---------------------------------------------------------------- |
| programme-activities.preview.private.jsonl |         16969 attività | 0a778d6bd6ec19b587be8e518df2b2097d60422171403d249ffea1a11506fbc9 |
| programme-links.preview.private.jsonl      |        36923 relazioni | 08c9d497c25bf99ca12f2a3ff374feceda81bd597aca1418bd82ecab31b5230d |

Fonte P6 candidata **MAIL20-07**, hash originale verificato20ott
`8e0b1b7766212b85457a3abec2c6ac83e6e1379ff916e6a0ddf138b6542111b5`.
La preview riusa i parse strutturali già acquisiti e i loro hash, senza riaprire
Download, eseguire il vecchio estrattore, convertire un workbook o interrogare DB.
Conserva ogni Activity ID, chiave interna P6, riga/campo sorgente, date, durate ore,
WBS, calendari, vincoli, stato e tipo di percentuale; tutti i36923legami hanno
predecessore/successore risolto nell’export. Nessuna attività o relazione scartata.
Il file nativo e i suoi dati non sono un programma già approvato per l’asset list
appena inviata: corrispondenza progetto/versione e crosswalk restano da attestare.

**Questi sono conteggi sorgente, non aggiunte pronte al motore corrente.**
Il batch completo è respinto dal contratto attuale, senza import o ricalcolo:

- 16969attività contro15000 **per richiesta**; niente troncamento o suddivisione
  che ignori i collegamenti.
- 28316relazioni FS;6664SS,1844FF,96SF e3codici PR_FS1 non riconosciuti.
  Sono8607relazioni non rappresentate da FS semplice;14lag sono negativi.
- 2099attività hanno durata sorgente zero; milestone e ore frazionarie non diventano
  attività da un giorno.6attività superano100predecessori, massimo324.
- 13calendari nel file,9usati;3073WBS,60risorse e27834assegnazioni non equivalgono
  ad asset, utenti o membership FieldTrack.226coppie predecessore/successore ripetute
  restano conservate, non deduplicate alla cieca.
- Tutte le attività dichiarano CP_Drtn: il campo physical % non diventa automaticamente
  progress. Date target_* non sono una baseline approvata. Ore/lag non vengono divisi
  per8 ignorando il calendario.

I manifest sono `reviewOnly:true`, `executionAllowed:false`, con source fields
privati e azioni target nulle. Non è stato aggiunto un parser P6 nell’app, cambiato
il limite schema o introdotta una conversione di comodo. La funzione locale di
preparazione legge soltanto JSON strutturali già presenti e produce artefatti di revisione.

## Mapping dei nuovi dati e diff target ancora ignoto

| Input/campo                    | Decisione già acquisita                                                                | Anteprima consentita ora e dato ancora necessario                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset export5nov14:12          | È il migliore dichiarato da Tony e prevale come sorgente candidata sul vecchio esempio | File non acquisito: hash, fogli, righe, ID e valori tutti pending. ATT-014 non sostituito. I suoi1354record candidati storici non sono il conteggio del nuovo file                                 |
| FR                             | FR→`asset.phase`                                                                       | Semantica confermata; header/tipi/valori e gestione Design phase separata da verificare nel file                                                                                                   |
| ID/nome/tipo/livelli           | Asset ID interno, riferimento cliente e Activity ID restano distinti                   | Conservare la chiave esplicita della sorgente, non dedurre un ID da nome o numero riga. Header e colonna chiave autorevole da leggere nel nuovo file                                               |
| Works to go                    | Nuova colonna e lista dashboard su richiesta                                           | Campo dedicato non esistente. Nella preview resta requisito/metadato separato; nessun valore inventato, conversione in issue/overdue o perdita silenziosa                                          |
| P6→asset                       | Dipendenze già fornite nel P6                                                          | Activity ID e chiave P6 conservati. Plant Ref/codici/nome sono candidati, non un join approvato. Richiesto crosswalk con la chiave del nuovo export, senza fusione automatica di programmi diversi |
| Checksheet5nov14:18→equipment  | Schede Excel con righe/risposte/firme e associazione a equipment governata dall’utente | File non acquisito: sezioni, passo, tipi risposta, ID/revisione e legame asset/template/istanza pending. Non sostituito con i vecchi PDF e non ridotto a una task per riga                         |
| Firmatari per progetto/livello | Configurazione flessibile modificabile dal team QA                                     | Categorie indicate da Tony conservate come riferimenti configurabili. Nessuna lista globale rigida, account/ruolo QA creato o firma dedotta dai template                                           |

Target: dominio produzione noto e progetto **osservato** AMS16 · Test con ID
`fcdb866f-12d4-4e85-a6b2-004ca1d53701`. La sua corrispondenza al nuovo exportACC/P6,
**account e membership di Tony, target DB effettivo, versione e snapshot record
non sono verificati**. Contatori UI nel progetto osservato:0asset/0programma/305task.
L’ID DOM acquisito non autorizza a sceglierlo per l’import: il progetto interno P6
è distinto e non si fondono dataset per nomi simili. Il manifest separa
`observedApplicationProjectId` dall’ID target d’import ancora null.

Aggiunte/aggiornamenti/invariati/rimozioni sono **null/ignoti**, non zero: manca
uno snapshot autorizzato del target. Non si dichiara +16969 o +1354 in produzione.
La preview definitiva confronterà ID e contenuto nel progetto esatto, baseline e
legami, più la visibilità prima/dopo per gli account approvati.

## Piano e minimo necessario per chiudere la preview

1. Ricevere i **due nuovi originali XLSX**5nov14:12 e14:18 qui in chat, già
   richiesti dalla regia a Marco a seguito del guasto download. Servono questi
   file, non un nuovo racconto o un altro P6 genericamente richiesto a Tony.
2. Verificare il **target già esistente**: dominio, progetto applicativo/ID,
   account e ruolo di Tony (username/email già richiesti dalla regia), membership, ambiente DB/progetto/branch/database/ruolo
   e versione/snapshot conteggi. Nessuna nuova chiave o credenziale in chat.
   Senza accesso visibile già autenticato, mantenere questi campi pending.
3. Chiudere il crosswalk esplicito asset↔Activity ID e asset↔checksheet dalle
   chiavi effettive dei file. Se non esiste, presentare le collisioni e una tabella
   di associazioni da confermare; non chiedere nuovamente FR o chi può configurare
   i firmatari, già chiariti. Fissare la corrispondenza progetto/versione del P6
   fra i programmi già acquisiti, senza sceglierla dal solo nome simile.
4. Presentare una preview per record con aggiunte/aggiornamenti/invariati/scarti,
   mapping campo per campo, dati non rappresentabili e hash. La compatibilità P6
   richiede un contratto/mandato di implementazione distinto: non basta aumentare
   un limite o dividere il file per conservare tutte le sue semantiche.
5. Solo allora sottoporre il piano preciso di scrittura: target e sorgenti
   nominati, account/visibilità, hash, diff, isolamento, idempotenza e rollback.
   Non è una nuova richiesta di scelta fra demo e dati reali.

Isolamento proposto per **dati reali**: solo il progetto esistente esattamente
verificato o un progetto reale dedicato concordato nello stesso ambiente
identificato, senza alterare altri progetti. Nessun nuovo servizio/branch creato.
Snapshot e manifest prima delle scritture, controllo della versione e transazione
atomica. Riesecuzione identica no-op; collisione parziale/diversa stop senza upsert
estranei. Rollback limitato agli ID/progetto del manifest e solo con assenza
verificata di modifiche successive; altrimenti stop e revisione. Nessuna cancellazione
per prefisso o ripristino sopra dati condivisi. Un eventuale export che registra
audit deve essere incluso nell’approvazione, non trattato come lettura senza effetti.

**Anteprima parziale pronta per revisione, non per esecuzione remota.** Nessun bug
locale dei filtri è dimostrato; nessun codice applicativo, suite completa, query o
scrittura remota, deploy, servizio o messaggio cliente introdotti da questo incarico.
