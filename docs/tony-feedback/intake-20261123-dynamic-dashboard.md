# Dashboard dinamica e verifica degli import — 23 novembre 2026

## Fonti e mandato

Marco ha fornito cinque messaggi di Tony del18nov2026,10:32:32–10:38:11 e uno
screenshot CPH3: report tag con0righe, due livelli di navigazione Dashboard/Reports
più raccolte report. Richieste: verifica AI dei criteri mancanti nell'import,
report disponibili dalla Dashboard, stesso report tag nei diversi accessi, meno
tab e assistente integrato che apra critical path, lookahead2settimane, avanzamento
vendor e tag report. I messaggi/allegati sono requisiti, il mandato operativo viene
da Marco e dalle istruzioni di progetto.

Lo screenshot prova un report tag vuoto, **non** un guasto di tutti i report.
L'import reale CPH3 e il suo contenuto non sono stati forniti né letti in produzione.
Nessuna causa è attribuita al progetto reale sulla base del solo PNG.
Monitor PAUSED; nessuna nuova lettura/invio WhatsApp.

## Richiesta → attuazione

| Richiesta                      | Risultato                                                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meno tab, dati dalla Dashboard | Un selettore Dashboard view sostituisce Dashboard/Reports e la raccolta di tab. Curve e riepilogo task in apertura; More project details richiude gli approfondimenti. Preferenze personali e default salvati conservati.                                     |
| Un solo report tag             | Tag report usa lo stesso CommissioningReport/tags dei drilldown dei grafici e dei vecchi link. Parità delle righe verificata. Test step progress resta una misura distinta, nominata esplicitamente; approvazione, risultato test e workflow non sono fusi.   |
| Assistente integrato           | Tolta la voce Assistant dalla sidebar. Le azioni AI/tastiera già in testata aprono il pannello contestuale senza lasciare la Dashboard. La route precedente resta compatibile.                                                                                |
| Chiedere viste                 | Comandi display per critical P6 salvato, original/current, lookahead2/4/6, vendor esplicito, tag/altri report, import review e overview. Uno scope progetto/versione e un ack della vista montata precedono la conferma. Nessuna modifica business implicita. |
| AI che cambia schermata        | Tool reale display_dashboard_view restituisce una richiesta pending-browser-ack; il client applica solo sulla Dashboard corrente dopo autorizzazione/versione. Fuori Dashboard offre un link, senza dichiarare la vista cambiata.                             |
| Verificare dati importati      | ReportReadiness aggrega11report e criteri/azioni scoped. Distingue ready/partial/missing/unavailable, zero valido, source assente, task non visibili e copertura parziale. API privata/no-store e tool reale review_import condividono il calcolo.            |
| Segnalazione dopo import       | Dopo salvataggio P6 dalla UI parte una verifica read-only e un avviso con Review report data. Errore della verifica distinto da import fallito. Nessun dato mancante viene creato per deduzione.                                                              |
| Vendor progress                | Il filtro usa soltanto equipment supplier registrato, con confronto esatto senza inferenze da owner/manufacturer/assignee. Nome sconosciuto produce un messaggio di mapping mancante, non avanzamento zero.                                                   |

Tutti i report precedenti sono raggiungibili dal selettore. URL legacy e filtri
validati restano leggibili. Filtri e finestra lookahead aggiornano l'URL senza
perdere focus/testo; gli echo asincroni già osservati vengono consumati, quindi un
link a un filtro precedente aggiorna davvero il report. Ogni richiesta display
riapplica i controlli, anche dopo cambi manuali. La curva usa un solo selettore di
vista e resta sopra la navigazione fissa mobile.

## Criteri e limiti

- Un P6 con date può alimentare curve/lookahead, senza avere asset, applicabilità
  livelli, test sheet o mapping vendor. Il programma non crea queste popolazioni.
- Criticità soltanto dalla regola float P6 salvata; unknown e working stale espliciti.
  Nessun ricalcolo CPM o traguardo Phase1 inferito (decisione precedente invariata).
- Target/baseline originali, finish working e actual datati restano distinti.
  Completati senza actual date rendono parziale la disponibilità della curva actual.
- Assenza di risposte, review e firme non equivale a fallimento del report o ad
  approvazione. Area/gruppo senza livelli può essere intenzionale. Mancanza globale
  di assegnazioni tag è segnalata; nessun livello è dedotto dai nomi attività.
- Gate credenziali letto: presenza locale verificata soltanto come booleano,
  consenso riuso10nov già registrato in PRODUCT. Nessuna nuova domanda, chiave,
  configurazione o chiamata AI live. Tool aggiunti al provider esistente; solo cap
  tool12→14 e istruzioni pertinenti, limiti di token/cicli invariati. Integrazione
  AI provata con mock, non con una chiamata a pagamento.
- Comandi esatti e controlli su dati salvati sono identificati come non generati da
  AI e funzionano anche con provider disabilitato. La capacità del provider attivo
  in produzione non è attestata da questi test.

## Verifiche e consegna

- **417** unitari/PGlite PASS; **17** mirati finali PASS. Nuovi casi per popolazioni
  P6-only, dati mancanti, completed senza actual, unknown/stale, criteri non mutanti,
  grammatica/negazioni, scope/versione, strict tool schema,14tool e provider mock.
- **3/3 API** PASS in sequenza: copilot saved reads/review_import, report condivisi,
  readiness. Accessi, no-store, parità API/tool, progetti inaccessibili e business
  record invariati; database remoto e provider disabilitati.
- **39/39 browser** PASS:30di flusso generale,7import reale dalla UI sintetica,
  2sincronizzazione query. Desktop1440, mobile390, tablet768. Critical/lookahead
  ripetuti dopo modifica manuale, vendor esatto e sconosciuto, tag legacy/canonico,
  criteria11gruppi, empty, stale reject, chat mantenuta, focus multi-carattere con
  assistente aperto, ritorno esterno a filtro precedente, nessun overflow/runtime.
  Nessun POST AI chat nei comandi display; solo normali salvataggi chat locali.
- Import UI di3attività su nuovo progetto **DEMO**, poi check automatico: lookahead
  pronto, tag/tagging mancanti, nessun asset o task inferito. Northbank riceve120
  attività P6 e18vendor fittizi soltanto nel processo locale, per il collaudo.
- Lint, TypeScript, formato dei file cambiati, diff-check e build finale PASS.
  Detector Impeccable `[]`; revisione indipendente **ship** dopo i fix su ack,
  focus/echo URL e copertura actual. Bug e problemi di attesa dell'harness risolti;
  risultati sopra si riferiscono ai passaggi finali riusciti.
- PDF inglese `output/pdf/fieldtrack-dynamic-dashboard-20261123-en.pdf`,6pagine,
  manifest pagina→modifica→fonte e render/ispezione **6/6 PASS**.
  SHA256 `357d71570547a1e438f880b6786ce3ce6e05cc7577c01b640c52852a7f21be73`.
  Prove private in `output/tony/dashboard-dynamic-20261123/`, fuori Git.

Viste autenticate e import collaudati soltanto nella demo sintetica locale,
poi browser/server chiusi. Nessuna scrittura business remota, migrazione, nuovo
servizio, spesa o invio cliente. next-env e modifiche documentali preesistenti
preservati. Quota conto25% all'avvio, uso ordinario consentito; nessun reset/acquisto.

## Rilascio e prossimo passo

Codice **424a1deab5644144633ac046be9b1385ec00eaa4** pushato normalmente su main.
Vercel **dpl_8h8wP8XrxNNHqmBLyfkG7TFGY5Qx READY**, alias
`time-tracker-tony.vercel.app` sullo stesso deployment. Overview200 e nuova API
readiness anonima401, verificati il **23nov2026,21:04:25CET**. Ricevuta privata
`output/tony/dashboard-dynamic-20261123/release-code.private.json`. Viste
autenticate di produzione e import reale CPH3 non attestati.

**Nuova correzione diretta Marco,23nov:** «non fare test per tutto e build ci sono
altri4messaggi in attesa». Accorpare i quattro prossimi feedback, evitando suite
complete/build/pubblicazione ripetute per ogni messaggio. Verifiche mirate dove
necessarie e chiusura complessiva del lotto. Il push di questo codice era già stato
eseguito prima della correzione; concluso soltanto il controllo read-only della
pubblicazione in corso. Nessun ulteriore build o push documentale avviato: rapporto,
PRODUCT, indice/registro e nuova lezione restano locali da includere con il lotto.

Prossimo passo immediato: acquisire i quattro feedback già annunciati da Marco.
Sui dati reali, Review import può leggere i criteri effettivi CPH3; aggiungere dati
soltanto verificati attraverso normali azioni app. Nessuna riparazione/importazione
remota o nuova chiamata AI autorizzata implicitamente da questa consegna.
