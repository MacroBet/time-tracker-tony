# Dashboard AI usage — 14 novembre 2026

Mandato diretto Marco: dashboard con consumi AI giornalieri e costi, accessibile
«solo ed esclusivamente per l'admin». Non è la dashboard del conto OpenAI o di
ChatGPT/Codex: il perimetro è tutto l'uso registrato da FieldTrack, su tutti i
progetti, indipendentemente dal progetto selezionato.

## Implementazione

- Voce **AI usage** nelle utility admin desktop/mobile, pagina `/admin/ai-usage`.
  Guardia server sulla pagina, guardia client, API autenticata admin-only e
  controllo del ruolo corrente nella query SQL. Manager, supervisor e worker
  esclusi anche accedendo direttamente all'URL o all'API. Nessun dato di consumo
  nel bootstrap condiviso; risposta `Cache-Control: no-store, private`.
- Periodi 7/30/90 giorni oppure date personalizzate inclusive, massimo 366 giorni;
  fuso Europe/Rome o UTC, filtri modello e fonte (chat/trascrizione), aggiornamento.
  Pagina globale senza selettore progetto o assistente contestuale.
- Totali, grafico giornaliero token/costo stimato/chiamate, tabella giornaliera e
  riepiloghi per modello e fonte. Tabelle scorrevoli e utilizzabili da tastiera;
  vuoto, caricamento, errore con retry e offline espliciti.
- Lettura della tabella privata `openai_meter_observations` già esistente. Una
  riga finale prevale sull'intento dello stesso tentativo prima dei filtri. Ogni
  chiamata/round al provider è un tentativo distinto; non coincide necessariamente
  con un messaggio. Pending non significa fallimento o richiesta gratuita.
- Cache e reasoning sono sottoinsiemi di input/output, senza doppio conteggio.
  Dati mancanti restano sconosciuti; i subtotali noti sono etichettati. Database
  indisponibile, metadati illeggibili o oltre 50.000 tentativi nel periodo danno
  errore esplicito, senza inventare zero o restituire totali troncati.

## Costi e copertura

Snapshot dei prezzi pubblici Standard in USD verificato il 14 novembre 2026:

- [gpt-5.6-terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra):
  input $2, cache read $0.20, output $12 per milione di token. Cache write
  [default 30 minuti](https://developers.openai.com/api/docs/guides/prompt-caching)
  $2.50 per milione, in sostituzione del prezzo input ordinario. Oltre 272.000
  token input, prezzi sull'intera richiesta: input/read/write raddoppiati e output
  moltiplicato per 1.5. Ripartizione cache mancante: intervallo minimo–massimo.
- [gpt-transcribe](https://developers.openai.com/api/docs/models/gpt-transcribe):
  $0.0045 per minuto di audio completato con durata nota.

Sono **stime, non importi fatturati**: nessuna integrazione billing/account,
sconto contrattuale, tassa o conversione valuta. Modelli non riconosciuti e
richieste non prezzabili rimangono evidenti e fuori dal subtotale stimato.
Nessun recupero di consumo mai registrato, né uso esterno a FieldTrack.

Le vecchie trascrizioni senza durata non hanno una stima. Le nuove conservano
soltanto la durata PCM validata dal server (massimo 30 secondi), in
`AttemptObservation.audioSeconds`; niente audio, trascrizione o prompt nel meter.
Il contratto `ApiMeterEvent`/collector v1 resta invariato. Nessuna modifica di
schema o migrazione: il nuovo metadato opzionale usa il JSONB già esistente.

## Come provarla

1. Accedere come admin, aprire **AI usage** dal menu (su mobile, utility in More).
2. Passare da 30 a 7 giorni e controllare totali/grafico/tabella; provare date
   personalizzate e UTC, filtro modello e fonte, quindi Apply filters/Refresh.
3. Alternare Tokens, Estimated cost e API calls. Confrontare i dettagli giornalieri
   con i totali; leggere la copertura delle stime e gli eventuali dati mancanti.
4. Con un ruolo manager/supervisor/worker, verificare assenza della voce e blocco
   dell'URL diretto. L'API non deve esporre dati senza un admin autenticato.

Demo locale: dati sintetici deterministici chiaramente etichettati. Nessun dato
sintetico in produzione, nessuna chiamata AI live o nuova chiave necessaria per
sviluppare e collaudare questa dashboard. Nessuna scrittura di prova nel DB remoto.

## Prove e rilascio

- 296 test unitari PASS; dopo la correzione della classificazione reale
  `outcome=incomplete/status=failure`, altri 11 test mirati PASS. La richiesta
  incompleta rimane distinta dal fallimento/pending e conserva i token misurati.
- 17 test API PASS nella demo locale isolata, inclusi autenticazione, esclusione
  dei tre ruoli, filtri, facets, 405 sulle scritture e privacy del DTO.
- PGlite applica le migrazioni solo in memoria: ruolo revocato, assenza di
  membership, canonicalizzazione prima dei filtri, DST 23/25 ore, durata audio,
  dati corrotti e limite dimensionale verificati. Nessuna migrazione remota.
- TypeScript, ESLint, formattazione mirata e build di produzione PASS. Build
  finale ricontrollata dopo l'unica correzione UI (filtri mobile a due colonne).
- Browser: 33 controlli PASS, desktop 1440 px e mobile 390/320 px senza overflow
  documento. Filtri, custom vuoto, cambio metrica, tastiera, More admin, URL/API
  esclusi per manager/supervisor/worker. Errore 503 e revoca client simulati con
  intercettazione locale; revoca SQL realmente provata in PGlite. Nessun errore
  runtime; soli errori rete attesi durante simulazione 503/riavvio demo.
- Prove private ignorate: `output/tony/ai-usage-20261114/` e
  `output/playwright/ai-usage-20261114/`. Nessuno screenshot/dato cliente in Git.

Codice `422a72e2855c73971a1176b89c548d8502e3f535` committato e pushato su
`origin/main`. Deployment GitHub `7793039575`, ambiente **Production**, stato
**success**; Vercel `time-tracker-tony-pfsrgmhm4-macrobets-projects.vercel.app`
**Ready**. Build normale senza gate/migrazione. Alias
`https://time-tracker-tony.vercel.app` HTTP200; API senza sessione HTTP401 con
cache privata/no-store, pagina anonima senza totali protetti. Controlli admin
autenticati svolti nella demo e in PGlite, non con query di prova sul DB remoto.
Ricevuta privata `output/tony/ai-usage-20261114/code-release-receipt.json`.

Prossimo passo: uso admin su dati registrati; nessun recupero retroattivo di
durata audio/consumi assenti e nessuna nuova integrazione billing implicita.

## Correzione select — nuovo mandato diretto 14 novembre

Marco segnala select visivamente incoerenti e chiede componenti adeguati e push
diretto in produzione. I filtri Timezone/Source/Model e il selettore progetto
nell'intestazione usano ora il componente Radix Select già incluso nello stack.
Etichette associate, focus/tastiera, Escape, touch target di 44 px; valore lungo
troncato nel trigger con spazio riservato alla singola freccia e testo completo
nelle opzioni. Menu limitato al viewport e opzioni a capo su mobile. Etichette
allineate; date a larghezza intera sotto 360 px per preservare icona e valore.

La selezione modifica i filtri in bozza, Apply filters li applica. Le opzioni
All models/All sources continuano a significare assenza di filtro: il valore
interno del componente non viene inviato all'API. Cambio progetto e pulizia
del parametro projectId conservati. Nessun nuovo package, DB o provider.

Prove locali: TypeScript, lint, formattazione e build PASS; 11 test dominio e
API admin-only mirata PASS. Browser: 37 controlli su desktop 1440 e mobile
390/320 px, selezione e reset, tastiera, focus ripristinato, cambio progetto,
assenza di overflow o sovrapposizione testo/freccia. Nessun errore runtime.
Un solo batch di correzione visiva e conferma finale; prove private sotto
`output/tony/select-fix-20261114/` e `output/playwright/select-fix-20261114/`.
Push/deploy del fix da registrare dopo verifica del target.
