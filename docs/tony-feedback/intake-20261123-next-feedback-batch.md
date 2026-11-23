# Lotto feedback successivi — 23 novembre 2026

## Regola corrente

Marco ha chiesto di accorpare i quattro messaggi in attesa, senza suite complete,
build o deploy per ogni feedback. Il lotto contiene **4/4 feedback**.
Chiusura e consegna visiva sono accorpate.
La Dashboard del lotto precedente è già online con codice424a1de; la relativa
documentazione è locale e va accorpata alla chiusura.

## 1/4 — Schedule: attività subito visibili

**Fonte diretta Marco:** «when i open its all menu and blank space when important
data is bottom of page», con screenshot Schedule/CPH3 fornito in questa chat.
Il PNG mostra controlli e filtri su più righe prima della timeline e molto spazio
vuoto; lo stato visibile è Loading. Non prova un caricamento definitivamente
fallito né l'assenza di attività nel progetto reale.

**Richiesta da attuare nel lotto:** portare le attività/Gantt nella prima schermata,
compattare intestazione e controlli primari, raccogliere filtri e impostazioni
secondari senza eliminare funzionalità. Evitare un'area vuota che spinga i record
in basso; distinguere attesa, errore e reale assenza di dati.

**Orientamento già letto:** SourceProgrammeWorkspace, SourceProgrammeGantt,
ScheduleViewControls e ScheduleWorkspace. Il layout attuale ha una riga di
proiezione, il blocco filtri (due righe ad alcune larghezze) e altri controlli prima
dei record. La modifica locale usa controlli
compatti e pannelli aperti su richiesta. Accettazione: prime attività leggibili
senza scroll iniziale e controlli avanzati ancora raggiungibili su desktop/mobile.

**Stato:** attuato in locale. La timeline apre sulle prime attività datate quando
la finestra iniziale non mostra barre per quelle righe. I filtri avanzati sono
raccolti in un pannello e lo stato di caricamento è compatto.

Originale privato, fuori Git:
`output/tony/feedback-batch-20261123/schedule-space-reference.private.png`.
SHA256 `8d7d74b19489221201663a13c8d7ddca576ac7567ad21c3f961fca9e3b51fe42`. Non è un import dati o una nuova lettura WhatsApp.

## 2/4 — Schedule: azioni in alto e comando vocale

Marco chiede di applicare le annotazioni dello screenshot e di poter dire
«Import» per aprire lo stesso pannello del pulsante. Le annotazioni indicano
Import, Changes ed Export in alto, meno testo sotto il Gantt e accesso a tutte le
attività. Lo screenshot è il riferimento visivo del progetto CPH3.

- Import apre l’upload P6 con file, anteprima e salvataggio esplicito. Il registro
  asset e schedule gestito rimane raggiungibile dal pannello.
- Changes apre la cronologia, con Schedule ID, provenienza del sorgente e ripristino
  amministrativo nelle opzioni pertinenti. Export prepara il CSV completo della
  vista di lavoro o della fonte P6 originale.
- Le azioni riconoscono comandi vocali finali brevi sullo Schedule e comandi digitati
  nello stesso assistente. Lo Schedule conferma l’apertura dopo il controllo di
  progetto e revisione. Il flusso di revisione resta in uso per le altre domande.
- Lo Schedule P6 scorre su tutte le attività filtrate con finestre sovrapposte di
  massimo 100 righe, accesso Home/End e salto per numero di riga. La guida del Gantt
  è accessibile dal pulsante informativo.

Prove sintetiche locali in `output/tony/feedback-batch-20261123/`. Playwright ha
verificato prima riga desktop/mobile, prima barra, salto alla riga 120 e ritorno,
filtri, Import da pulsante e voce simulata, Changes e CSV completo. Test mirati
sorgente e voce, lint dei file modificati e diff-check passati. Il microfono reale
non è stato usato. Screenshot della demo salvati per il PDF unico del lotto.

Originale privato in `output/tony/feedback-batch-20261123/schedule-actions-reference.private.png`,
SHA256 `fa5f502dd261c299e3575c21aec282a37d374d48b1e2e3d011d9638d23450e8c`.

## 3/4 — Navigazione desktop a icone

Marco chiede «lets make this icons only,,, click at top to view all» e allega
la barra laterale desktop. AppShell apre con una barra da 64 px. Il comando in
alto apre il menu con tutte le etichette e la larghezza da 224 px. La scelta
vale durante la navigazione nella stessa scheda. Al ricaricamento torna a icone.
La pagina attiva è evidenziata e i nomi dei collegamenti restano disponibili
alle tecnologie assistive e al passaggio del mouse. Su telefono si usa la barra
inferiore già presente. Le voci mostrate seguono ruolo e moduli dell’utente.

Controllo Playwright nella demo sintetica su desktop e mobile. Apertura da
tastiera, cambio pagina con menu aperto, ritorno alla barra a icone e barra
inferiore mobile verificati. Lint AppShell e diff-check passati. Schermate dei
due stati in `output/tony/feedback-batch-20261123/` per il PDF del lotto.

Originale privato in `output/tony/feedback-batch-20261123/sidebar-icons-reference.private.png`,
SHA256 `e5a021742fc583466f9690871fb0bb3e4801b9ec1efbdbfde6b23115c7dd0b58`.

## 4/4 — Issues overview nella Dashboard

Marco ha fornito «Overview Reference», una foto di un riepilogo issue con
indicatori, filtri e grafici. Il riferimento descrive la struttura della vista.
Valori, marchio e dati dell'immagine non sono fonti per FieldTrack.

- La vista si apre dal selettore Dashboard o con «Show me issues overview»
  nell'assistente contestuale. Serve accesso alla Dashboard o ai Report e
  ai Task del progetto.
- Il riepilogo usa le issue registrate, con aperte e completate distinte
  dalle non applicabili. La media usa i giorni di calendario dalla creazione
  per le issue attualmente aperte con data utilizzabile, arrotondati al giorno.
- Grafici di stato, azienda assegnata e mese di creazione. Tipo e causa
  principale si leggono quando disponibili nei metadati originali delle
  issue importate. I grafici e i filtri aggiornano lo stesso elenco di record.
  I dati mancanti sono espliciti. La finestra cronologica usa le date del progetto.

Originale privato in `output/tony/feedback-batch-20261123/overview-issues-reference.private.png`,
SHA256 `5e54c430db2e505dd963cd3d04376f4265209b6fc10165bd39b15d037f33f644`.

## Verifica unica del lotto

Suite Node/PGlite 419 casi, 418 verdi nella prima esecuzione. Rimosso il
trattamento come import Excel dei record demo, mantenendo i record manuali
sintetici e i casi aperti/chiusi. Riesecuzione mirata dei tre file coinvolti
13/13. Lint, TypeScript e build superati. Browser finale 12/12, inclusi accesso
dal selettore, drilldown 8→3, apertura record, comando locale, mobile e stato
vuoto. I test dei metadati includono tipo, causa principale e valori mancanti.
I test Schedule del lotto coprono lo scorrimento fino alla riga 120, i controlli,
il CSV completo e il comando vocale simulato.

Le prove sono locali e sintetiche. Nessun microfono reale, chiamata AI generativa,
invio esterno o scrittura di dati operativi remoti. PDF inglese di sei pagine,
renderizzate e ispezionate 6/6, in
`output/pdf/fieldtrack-schedule-overview-20261123-en.pdf`. Manifest privato
pagina→modifica→schermata in `output/tony/feedback-batch-20261123/`.
