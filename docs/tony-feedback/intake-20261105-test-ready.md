# Consegna per il collaudo con dati reali — 5 novembre 2026

Nuovo job `tony-test-ready-delivery-20261105`, request
`tony-test-ready-delivery-request-20261105`. Fonte umana verificata nella regia:
`01a1ac8a-c70f-7973-b5bc-983ee3fcfcf5`. Marco chiede di finire e consentire il
collaudo, dichiarando la produzione ambiente di test. Sono autorizzati sviluppo,
commit/push/deploy e normali operazioni app scoped con conservazione dei dati.
La preview precedente resta conclusa, con i suoi limiti storici; non è riaperta.
Nessuna nuova chiave, API pagata, servizio, ruolo, reset o spesa.

## Implementazione

- **P6 completo separato dal motore di calcolo:** parser XER e archivio di tutte
  le20tabelle/277200record/3881555campi,16969attività,36923relazioni,13calendari
  e3073WBS. Date, valori vuoti, origine/riga, milestone, FS/SS/FF/SF/tipi sconosciuti
  e lag negativi/frazionari conservati. Gantt e filtri paginati50righe raggiungono
  l'ultima attività oltre15000. Nessuna conversione silenziosa o ricalcolo P6;
  baseline approvate e critical path non vengono inventati. Progetto LHR11 distinto.
- **Inventario additivo1354:** payload selezionato SHA256
  `47b96185fb6951bc811492491bb1b1f6301f3080404ee37c1ebb46b3f05b30fa`,
  Product/System→equipmentType, FR→phase, levels[] e ID applicativi proposti
  manifest-owned. Sono voci d'inventario derivate dalla fonte, non attestazioni
  d'installazione o identità fisica. Le1321cache FR non sono ricalcolate. Nessuna
  deduplica per nome né modifica ai305task/18assegnazioni esistenti.
- **Ripristino controllato:** preview/conferma, versione e hash per batch. Rimuove
  solo aggiunte proprie ancora identiche e non referenziate, mantenendo audit,
  altri asset, programma e task. Riferimenti checksheet/Works to go bloccano il
  restore. I nuovi collegamenti task→asset avanzano atomicamente la versione del
  progetto: CAS e controllo SQL impediscono il ripristino su snapshot obsoleto.
  Il programma sorgente ha un undo amministrativo solo su progetto senza altro
  lavoro, con versione/SHA e preview, conservando progetto e audit.
- **Checksheet e firmatari:** due template con26+26requisiti, associazione esplicita
  a equipment, risposte/esiti/firme inizialmente vuoti. Firmatari configurabili per
  progetto/livello tra utenti/ruoli esistenti; firma dell'attore autenticato, storico
  invalidazioni dopo cambi. Nessun ruolo QA inventato o approvazione attribuita a
  Tony. Le associazioni non generano task in massa.
- **Works to go:** elenco persistente di lavoro residuo con apertura/completamento/
  riapertura e riepilogo dashboard; non sostituisce stati, risultati o assegnazioni.
- **Video evidence:** MP4 H.264 avc1 non frammentati, AAC-LC opzionale, massimo
  30secondi e2MiB/file,20file/task come limiti di storage esistenti. Controlli server
  su struttura, timing e tabelle sample, senza fidarsi di MIME/durata client.
  Non è certificazione tramite decoding o antivirus. Edit list, B-frame offsets,
  HEVC e formati fuori profilo sono rifiutati; nessun provider attivato. Player
  autenticato, muto inizialmente, controlli e byte-range; accesso resta legato alla task.

Il grande archivio P6 non è inviato nel bootstrap. API paginata autorizzata per
membership/modulo e management; worker limitato a schede e asset del proprio
lavoro assegnato. Salvataggi ordinari preservano sorgente e audit fuori snapshot.

## Prove locali concluse

- 152test unitari iniziali,5test MP4 e6test SQL di persistenza/trasporto sorgente:163pass
  complessivi nei rispettivi run; PGlite usa migrazioni reali. Gli interleaving SQL
  ordinati sono verificati; non è una prova di contesa con più backend live.
- 10API di regressione:9pass al primo run, test generazione corretto per la nuova
  guardia di versione e poi passato. Nuovo collaudo API inventario/checksheet/P6
  passato separatamente in ambiente demo isolato.
- Typecheck, lint mirato, detector UI e build di produzione passati. Nessun audit
  dipendenze ripetuto: questo lotto non modifica dipendenze o migrazioni.
- UI Chrome headless isolata1440×1000 e390×844: import P6 reale e ultima attività,
  rimozione/reimport sorgente,1354asset aggiunti preservando task e programma,
  template52requisiti, una associazione con risposte/firme vuote, asset assegnato
  visibile al worker e altro asset non assegnato assente. MP4 sintetico1secondo:
  upload, range206/416 e riproduzione effettiva passati. Zero errori pagina.

Queste prove sono **locali**, non quattro login o import in produzione. Originali,
payload, screenshot e ricevute restano privati sotto output e fuori Git.
`output/playwright/tony-test-ready-20261105/ui-validation.private.json` e
`output/tony/test-ready-delivery-20261105/` contengono le prove riproducibili.

## Rilascio e caricamento

Push normale su main riuscito: contratti `e53291a`, integrazione
`db9ab845f9c21ba417ea5ecff3dc442618b79f8a`. **Vercel Production success** verificato
5nov17:11:53UTC, deployment7580184310 /4Gj3nV6rjqxUw21Nof2UXW5qYT1K.
Il follow-up server riduce a un solo parametro l'archivio P6 di32,63MB: richiesta
parametri40,40MB misurata offline, senza duplicazione. Copre anche lo snapshot
commissioning NULL dei progetti nuovi. Sei test SQL pertinenti e nuova build verdi;
nessun reimport locale P6/inventario ripetuto. SHA/deploy follow-up da verificare.
Gli import reali non sono ancora eseguiti: test locali e rilascio restano distinti.
Sessione browser della regia già autenticata Test admin/Admin su FieldTrack Test.
Baseline nativa: AMS16 · Test, UUID`fcdb866f-12d4-4e85-a6b2-004ca1d53701`,
0asset/0programma/305task; worker18assegnazioni,16aperte/2complete. Export JSON/CSV
vuoto disabilitato: nessun backup file creato, limite documentato. Prima dell'import
verificare nuovamente versione e baseline, conservare ricevuta del registro vuoto.

**Creazione LHR11 conclusa:** dopo il rifiuto iniziale della località provvisoria,
Marco ha risposto «Sì, usa questo valore provvisorio» alla domanda specifica. La
normale UI ha creato LHR11, FieldTrack Test, UUID
`08ef7190-c42e-46fc-9e2e-873d5c84dd0b`, con il valore esatto «Località non
specificata nella fonte — import di test». Nessuna creazione parallela. Al primo
riscontro solo Test admin ha il nuovo progetto; gli altri tre account conservano AMS16.

**Limite upload corrente:** chooser.setFiles non può leggere i file locali perché
l'estensione ChatGPT non ha «Consenti accesso agli URL dei file». Marco ha approvato
l'attivazione temporanea e successiva disattivazione; il tool browser blocca però
chrome://extensions e vieta alternative/CDP. Non è stato cambiato alcun permesso,
non c'è un grant automatico da ripristinare. La regia ha chiesto l'azione manuale
esatta in Chrome e attende «Fatto». Nessun file, preview live, import, template o
nuova task creati;305task e18assegnazioni ancora intatti. Non aggirare questo limite
con fetch, cookie, un altro browser o percorsi indiretti. La disattivazione finale
sarà manuale, da ottenere/verificare, non promessa come automatica.

Pacchetto operativo privato: `output/tony/test-ready-delivery-20261105/production-ui-handoff.private.json`.
Ordine: inventario scoped in AMS16, verifica/no-op/preview restore; template senza
risultati; una associazione di collaudo e un nuovo incarico esplicito al Test worker;
progetto LHR11 distinto e import P6 completo. I305task e18assegnazioni preesistenti
restano identici: un nuovo incarico significa306task/19assegnazioni, non modifica
massiva o completamento inventato. Membership LHR11 eventualmente aggiunta agli
account esistenti preservando i progetti già consentiti, senza cambiare ruoli/moduli.

Collaudo live atteso dall'operatore Admin; contratti degli altri ruoli già provati
localmente. Nessun cookie/credenziale in output o impersonazione per fingere4login.
WhatsApp nativo in timeout: nessuna nuova copertura oltre5nov14:19 o domanda inviata.

## Percorso ripetibile per Tony

| Ruolo                         | Progetto/pagina                 | Prova attesa                                                                                                                           |
| ----------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Admin/manager/supervisor      | AMS16 · Test → Assets           | 1354voci reali, filtri Area/Phase, dettagli e batch tracciato                                                                          |
| Management                    | Checksheets & works to go       | 2template/52requisiti; scegliere equipment e template, verificare risposte vuote; configurare firmatari reali                          |
| Worker                        | My tasks → incarico di collaudo | Task effettivamente assegnata, asset e scheda associata visibili; altri asset non assegnati assenti                                    |
| Worker/management autorizzato | Task → Evidence                 | MP4 supportato≤30s/2MiB, riproduzione/download; note scritte per contenuti parlati                                                     |
| Management                    | LHR11 → Programme               | 16969attività/36923relazioni; filtri e ultima ActivityID`COM-P2-LV4-17836`; dettaglio relazioni/calendario; nessun ricalcolo attestato |
| Management                    | Overview / Works to go          | Aggiungere un lavoro residuo reale, completarlo/riaprirlo; conteggi coerenti senza cambiare lo stato delle task                        |

Restano da concordare le regole universali di sequenza/applicabilità e rating
Health; i materiali non le definiscono. Non impediscono il collaudo dei controlli
espliciti consegnati e non sono sostituite da automatismi inventati. Video oltre
il profilo corrente o archivi location indipendenti richiedono un contratto distinto.
