# Originali e anteprima reale — 5 novembre 2026

Prosecuzione dello stesso job `tony-production-data-reconciliation-20261105`,
request `tony-production-data-reconciliation-request-20261105`. Marco ha fornito
i due originali richiesti e i quattro indirizzi di collaudo. Nessun import remoto,
seed, modifica applicativa, nuovo servizio, deploy o invio cliente autorizzato.

**Acquisizione e analisi concluse; anteprima completa e prima tranche di solo
inventario pronta per revisione: 1354 asset validati offline, con ID applicativi
proposti. Nessun import approvato o eseguito.** La scelta di dati reali è già fissata.
Il piano usa il normale import dell'app, senza nuove credenziali o privilegi SQL.

## Provenienza verificata

Copie byte-identiche in `output/tony/data-reconciliation-20261105/originals/`,
ignorate da Git. Solo i due percorsi allegati esplicitamente da Marco sono stati
letti in Download, senza scansioni o recuperi alternativi WhatsApp.

| Fonte                            |     Byte | SHA256                                                           | Versione/provenienza                                                                                                           |
| -------------------------------- | -------: | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Asset List allegata5nov          |  1417083 | f613b7e55277a39589389051665b616eca6705824beb7e06001d389132b57dfc | Identica binariamente ad ATT-014, confermato dal nuovo originale. Non semplice equivalenza del nome                            |
| Workbook fornito come checksheet |    32055 | 62c29b84f04f6c69238cfb6431069b26c5eaa77545682886b589955b963e1304 | Nuovo originale ATT-030; titoli gPOR3.3.10 e3.3.20. Metadati file/data nel nome non provano una revisione di dominio approvata |
| P6 MAIL20-07 già acquisito       | 23590083 | 8e0b1b7766212b85457a3abec2c6ac83e6e1379ff916e6a0ddf138b6542111b5 | Parse strutturale già verificato e riusato, senza nuovo accesso all'originale o troncamenti                                    |

Due copie acquisite in questa ripresa, **un solo nuovo contenuto binario**:
l'Asset List ripete ATT-014, il workbook requisiti è ATT-030. Il manifest mantiene
la distinzione fra messaggio ricevuto, copia del file e originale univoco.
Nessun workbook riscritto, ricalcolato o eseguito. Analisi con skill Spreadsheets,
letture XML e librerie del runtime fornito; formule e cache separate.

## Asset List: fonte, mapping e collisioni

Quattro fogli: Simplified list, ACC TAB - Assets, ACC TAB - Systems,
ACC TAB - Locations. Sorgente delle **1354 righe candidate**:
`Simplified list!A2:P1365`, escluse9righe vuote e la notaA705. Le righe fisiche
fino25466 non sono asset. Riconciliati tutti i21664valori candidati con il nuovo
originale e il preflight ATT-014: nessuna differenza.

| Sorgente                       | Campo proposto/uso                   |                Conteggio | Anomalia o decisione                                                                                 |
| ------------------------------ | ------------------------------------ | -----------------------: | ---------------------------------------------------------------------------------------------------- |
| A2:A1365 Commissionable Asset  | name                                 |                     1354 | 1164nomi distinti,179gruppi ripetuti; non una chiave                                                 |
| D2:D1365 Product/System        | equipmentType proposto               |                     1354 | Conserva1354tuple distinte nella proiezione sotto; mapping da approvare                              |
| G2:G1365 QCx L1-4 Asset Type   | Classificazione separata             |                     1354 | Non equivale a livelli obbligatori L1–L4. Usarlo come unico tipo collassa distinzioni Product/System |
| F2:F1365 FR Zone               | phase, conferma Tony FR→Phase        |          FR1=847,FR2=507 | 1321cache di formula non ricalcolate. Design phaseE resta separata                                   |
| B2:B1365 / C2:C1365 / J2:J1365 | discipline / area / location da Room |         1354 /1354 /1283 | 71Room vuote, nessun floor o fornitore inventato                                                     |
| H2:H1365 Asset Code            | Classificazione sorgente             |                     1286 | 68mancanti, codici ripetuti; non ID interno/client                                                   |
| ACC Assets M/O/T6:2733         | Barcode/CMMS ID/serial               | 0ID nelle righe con nome | Nessuna chiave equipment univoca da conservare come ID app                                           |
| K2:K1365 eL2:L1365             | Flag applicabilità3.3.10/3.3.20      |        864true /1283true | 793righe con entrambi; non sono istanze checksheet o livelli tag                                     |
| M/N/O2:1365                    | Non Dense/Optional/QCx Tagged        |         1199/238/907true | Non trasformati in workflow, approvazione o completamento                                            |
| P2:P1365 Comments              | Contenuto sorgente                   |               12nonvuoti | Works to go è assente: non si sostituisce con Comments o stato Installed                             |

Nessun duplicato di riga completa. Per la proiezione
`name + equipmentType + phase + discipline + area + location`, scegliere
QCx Asset Type come tipo produce **176gruppi di collisione,363righe**,1167tuple
distinte e187righe eccedenti. Product/System distingue tutti quei gruppi:
**1354tuple distinte, zero collisioni in questa proiezione**. È una proposta di
mapping motivata dai dati, non un'identità equipment approvata né una deduplica.
I nuovi ID applicativi sono soltanto proposti nella preview: non vengono presentati
come ID BIM/cliente né assegnati in produzione.

Tutte le1354righe superano assetSchema, registerImportSchema e lettore JSON
attuali con ID interni proposti e `levels: []`, ammesso senza minimo dallo schema.
Il roundtrip CSV conserva i valori. Merge puro su riferimento ipotetico vuoto:
1354aggiunte/0errori; secondo passaggio identico:0modifiche/0errori. Non è un diff
remoto. I12trim nativi dello schema (11nomi e1location) sono documentati, con
valori sorgente integri nel manifest; nessun troncamento, rinomina o deduplica.

Nel workbook ci sono16666formule e1579cache vuote/null, soprattutto nelle viste
ACC. ACC Assets ha1355nomi perché propaga la nota sorgenteA705 inA709, con stato
Installed; non è un1355°asset candidato.1373righe senza nome conservano categorie
o location generate e non vengono importate. ACC Systems usa anche range più corti
della sorgente: non è una tabella completa di nuovi equipment. Nessun errore cella
attestato implica che formule/cache siano corrette o aggiornate.

Il lettore canonico XLSX dell'app è stato provato offline sul file: lo respinge
per formule/riferimenti non supportati. Non è stato generato un workbook corretto
o eseguito un import. Il JSON proposto separato contiene la proiezione esplicita;
tutte le16colonne sorgente e le prove di formula/cache restano nel manifest privato.

## Workbook gPOR: contenuto effettivo

Il file fornito come esempio contiene **52 requisiti Temporary Cx Facility**, non
un form con campi risposta e firma. Due fogli visibili, ciascuno26requisiti in
`A5:E30`: `3.3.10 Temp Facility requiremen` e `3.3.20 Temp Facility requiremen`.
Il terzo foglio Lists contiene vocabolari sorgente. Conservate87righe significative
e314celle non vuote;970righe di coda vuota per foglio non sono domande o task.

Campi effettivi: Item, Requirement, Equipment, Discipline, Notes. Equipment è una
categoria, non un Asset ID. **Colonne risposta/esito/firma/data assenti**, non campi
individuati ma lasciati vuoti. Zero esiti o firme attestati;2commenti storici non
sono firmatari, assegnazioni o date di completamento.

Anomalie conservate: Item21 duplicato in3.3.10!A24:A25 e Item10 assente;
8validazioni lista con `#REF!`, nessun definedName;3.3.20!C10 edE11 vuote;
filtri che non coprono tutte le righe/colonne. Non rinumerare, fondere, riparare
dropdown o convertire colori/commenti in esiti. Nessuna formula di cella, macro
o connessione esterna. Il lettore asset attuale respinge il file per più fogli:
non è un file asset e non viene trasformato in52task.

## Join documentali e P6

Preparati **2147 riferimenti di applicabilità** dai864+1283flag positivi ai codici
famiglia3.3.10/3.3.20 presenti nei titoli del workbook. È un riscontro di codice
con source_ref, non un'assegnazione equipment/istanza. Nessun filtro equipment
applicato e nessuna espansione automatica in55822task/requisiti per asset.
Associazioni approvate:0. Il join asset↔Activity ID P6 resta non verificato.

P6 conserva16969ActivityID univoci e36923legami completi, ma il batch non è
compatibile con il motore corrente:15000attività per richiesta,8607relazioni
nonFS,14lag negativi,2099durate zero,6attività oltre100predecessori, calendari/WBS
e risorse non rappresentati. Nessuna nuova richiesta di predecessori/successori
a Tony: sono già presenti. Nessun parser, nuova semantica o limite modificato.

## Account e target

I quattro indirizzi forniti esattamente da Marco sono stati verificati dal child
reale nella vista Team della sessione Admin, con match email esatto. I ruoli non
sono stati dedotti dagli indirizzi:

| Account             | Profilo/ruolo letto          | Progetto esplicito |
| ------------------- | ---------------------------- | ------------------ |
| worker@test.com     | Test worker / worker         | AMS16 · Test       |
| supervisor@test.com | Test supervisor / supervisor | AMS16 · Test       |
| manager@test.com    | Test manager / manager       | AMS16 · Test       |
| admin@test.com      | Test admin / admin           | AMS16 · Test       |

Azienda FieldTrack Test, progetto osservato ID
`fcdb866f-12d4-4e85-a6b2-004ca1d53701`,0asset/0programma/**305task**.
Team mostra18assegnazioni al worker:16aperte,0review,2complete,11% visualizzato.
Nessun login alle quattro sessioni, impersonazione o cambio di membership.
Le domande su indirizzi/ruoli sono chiuse. Restano da approvare la destinazione dei
file e, prima di salvare, stato/versione correnti e preview tramite l'app. Non
occorrono nuovi privilegi SQL, nuove credenziali Neon o identificativi backend
per proporre il normale import nel progetto osservato.

## Piano preciso proposto, non autorizzazione di scrittura

Primo lotto: **solo inventario**, usando la sessione admin dell'app e AMS16 · Test,
ID `fcdb866f-12d4-4e85-a6b2-004ca1d53701`, se approvato come destinazione.
Product/System→equipmentType, FR→phase, altri campi diretti della tabella;
1354ID interni proposti e fissati nel manifest: `inv-` + SHA256 del JSON ordinato
`{sourceSha256,sheet,row}`. Non sono ID cliente. Una nuova versione del workbook
richiede crosswalk revisionato, non matching per nome o rigenerazione indiscriminata.
Unica variante selezionata: payload del child nativo della regia, SHA256
`47b96185fb6951bc811492491bb1b1f6301f3080404ee37c1ebb46b3f05b30fa`.
La precedente proposta locale, con ID diversi, è superata e non va mescolata.
Verifica centrale: tutti i16campi/riferimenti conservati, ID ricalcolati in Python,
proiezione ricostruita dalla fonte, hash dei contratti invariati; esito positivo.

Policy iniziale possibile da approvare: livelli esplicitamente vuoti per un
registro equipment-only, senza generare tag/task. Non dedurre livelli dal titolo
QCx L1-4. Campi non rappresentati (Product/System o classificazione QCx a seconda
del mapping, Design phase, descrizioni/flag/Comments e riferimenti documentali)
restano negli originali/sidecar: la proiezione parziale va approvata esplicitamente.
Works to go è assente e richiederebbe un campo distinto, non dati fabbricati.

Scenario **condizionale**, dopo verifica dello stato/versione tramite app, identità e
mapping approvati:1354aggiunte asset,0aggiornamenti/cancellazioni dei305task,
0nuove task e0modifiche programma. Il **diff effettivo resta null/ignoto** senza
snapshot/versione target, non si dichiara +1354 già pronto. Il solo import asset
non collega i305task esistenti ai nuovi equipment e non rende automaticamente
visibili ai worker gli asset privi di lavoro assegnato. Per admin, manager e
supervisor autorizzati sul progetto è attesa la visibilità del registro, secondo
membership e moduli esistenti; non è un collaudo diretto delle quattro sessioni.
Per il worker la tranche non aggiunge lavoro assegnato né garantisce nuovi asset
visibili. Un test completo worker richiederebbe una scelta precisa di task↔asset
e assegnazione, da proporre separatamente. Nessun collegamento per nome ai305task,
cambio di assegnazioni, ruoli o membership è incluso.

Il piano da approvare comprende target e SHA esatti, manifest ID, valori FR da
cache, livelli vuoti e campi esclusi. Prima del salvataggio, tramite il normale
flusso dell'app: conservare stato/export/versione correnti, verificare collisioni
e riferimenti task, ottenere una nuova preview con1354aggiunte/0aggiornamenti/
0errori e nessuna modifica a programma/task/assegnazioni. Qualsiasi differenza o
cambio versione impone stop e nuova revisione. Non è stata chiamata la preview
live, neppure per diagnosi. File e account non vengono richiesti nuovamente.

Idempotenza offline provata: stesso hash+manifest e record identici→no-op;
collisioni parziali o diverse→stop senza upsert estranei. Il server ritorna
`updated:false` prima della persistenza se non ci sono cambi: lettura del codice,
non test remoto.

Rollback proposto: conservare prima-stato e versione; eventuali correzioni dei
campi degli stessi ID possono usare import normale con nuova preview/versione.
Il ripristino completo richiederebbe rimuovere soltanto le1354aggiunte del manifest,
con versione/hash attesi, nessuna modifica successiva o link estraneo e audit
conservato, senza toccare programma,305task e18assegnazioni. **L'import attuale
non offre cancellazione/ripristino: omettere record o importare un file vuoto non
annulla le aggiunte.** La rimozione completa non è oggi eseguibile con quel flusso;
questa disponibilità va concordata prima di salvare, senza workaround SQL. Nessuna
funzione di rollback è stata sviluppata e nessuna scrittura viene avviata.
Istanze multipasso/risposte/firme e P6 completo richiedono contratto e mandato di
implementazione separati; non sono inclusi silenziosamente nel lotto equipment.

## Artefatti e verifiche

Anteprima leggibile e manifest aggiornati:
`output/tony/data-reconciliation-20261105/real-data-preview.private.md` e `.json`.
Unico payload selezionato:
`output/tony/data-reconciliation-20261105/inventory-selected/inventory-register.proposed.private.json`,
385223byte, SHA256`47b96185fb6951bc811492491bb1b1f6301f3080404ee37c1ebb46b3f05b30fa`.
Manifest sorgente/ID, anomalie e ricevuta schema/reader/merge nella stessa cartella;
hash originali del child verificati prima e dopo la copia. Riesame centrale in
`inventory-selected-owner-review.private.json`. Non usare la precedente variante
`inventory-tranche.preview.private.json`, conservata solo come storico privato.
Contengono source_ref, conteggi, campi mancanti/non rappresentati, collisioni,
2147riferimenti di codice e link ai1354record asset/87righe workbook/P6 completo.
Originali e contenuti privati fuori Git; soltanto analisi/manifest delle fonti qui.

Ownership: lettori indipendenti asset e requisiti, con scritture limitate agli
artefatti privati assegnati; integrazione e verifiche centrali dell'owner.
Hash originali e righe/campi conservati, nessun ricalcolo. Due controlli del parser
esistente e verifiche analitiche di conteggi/hash/riferimenti; nessuna suite
applicativa o audit dipendenze ripetuti. next-env.d.ts preservato.
