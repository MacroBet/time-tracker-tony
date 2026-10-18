# Preparazione AI — lotto locale 18 ottobre 2026

- requestId: `tony-ai-preintegration-request-20261018`
- jobId: `tony-ai-preintegration-20261018`
- Owner unico: Mea World System; regia `01a1493a-ee0b-7d62-a861-d8d546bf013c`.
- Intake correlato: revisione538, come riportato nel mandato ricevuto.
- Esecutore: chat `01a14fd3-47ba-77e1-9184-f8355c1d23d1`.
- Stato: lotto locale completato; provider live non attivato.
- Timestamp nativo rilevato durante la validazione: `2026-10-18 16:25:32 UTC`
  (18:25:32 Europe/Rome). Consumo job: `null`, non misurato.

## Mandato e fonti

Il mandato trasmesso dalla regia autorizza il più piccolo sviluppo preventivo
utile, test con mock e commit locale, senza push/deploy/DB remoto o chiamate API.
Riporta la scelta già risolta di Marco: configurazione personale e riuso della
chiave dedicata in `.env.local`, conferma «messa». La regia ha verificato soltanto
presenza/formato, file ignorato e non symlink; l'esecutore non ha letto, stampato,
copiato o modificato il segreto. Autenticazione remota non verificata. Questa
informazione supera l'attesa storica della chiave, non il gate d'uso live.

Fonti lette: AGENTS, PRODUCT, indice e README agente, registro operativo,
[intake17ott](intake-20261017.md) e README principale. Tony chiede priorità al
modello funzionante, organizzazione asset per sequenza/area/fase e riuso delle
specifiche. Sequenza tipica, multifase e regole delle specifiche condivise restano
da definire: nessuna nuova funzione di prodotto è stata dedotta.

La base richiesta esiste già in `0f80a4e`: provider Responses, configurazione
server-only disattivata per default, limiti di input/output/tempo/tool, strumenti
di lettura e proposta, conferma task separata con vincoli di sessione e versione.
Consultate le guide Next locali su environment e route handler e la
[documentazione ufficiale function calling](https://developers.openai.com/api/docs/guides/function-calling).
Il contratto stateless esistente con `store:false` e replay degli output resta
invariato; non costituisce promessa di assenza di ogni conservazione del provider.

## Lacuna corretta e verifica

Il timeout interrompeva l'attesa della risposta, ma il lettore non cancellava
esplicitamente uno stream bloccato dopo gli header. Inoltre la cancellazione
attesa nel `finally` poteva trattenere un errore di dimensione fino al timeout
se la sorgente non completava `cancel()`.

`src/lib/copilot-provider.ts` ora cancella lo stream su abort e sulle risposte
troppo grandi, sia dichiarate negli header sia rilevate durante la lettura.
Cancellazione best-effort non bloccante, listener rimosso e reader rilasciato.
Nessuna modifica a strumenti, endpoint, flag, credenziali o mutazioni.

`tests/copilot-provider.test.ts` aggiunge due test, con sorgenti sintetiche e
`cancel()` intenzionalmente pendente: timeout dopo gli header, oversize dichiarato
e reale, lock rilasciato e zero esecuzioni tool.

Prove locali: 22 test copilot mirati; suite completa **105/105** inclusi test
PostgreSQL in memoria; typecheck, lint e build Next passati. Tutte le esecuzioni
con chiave/modello e URL DB vuoti, flag live false; build in demo. Nessuna chiamata
provider o test remoto. Revisione statica indipendente senza rilievi bloccanti.
API/browser non ripetuti: nessuna modifica a route, permessi, proposta o UI.
`next-env.d.ts` ripristinato byte per byte al contenuto preesistente dopo la build.

Limite preesistente: il timeout non può cancellare lavoro arbitrario dentro un
callback `executeTool`; gli strumenti attuali leggono o preparano proposte locali,
senza applicare modifiche persistenti. Nessuna garanzia più ampia introdotta.

## Git, blocchi e prossimo passo

Base locale `39db18e`, catalogo `5cd5ca9` preservato. Fetch tentato: errore SSH
`Permission denied (publickey)`; confronto col riferimento locale origin/main
5 commit avanti/0 indietro, riferimento non aggiornato. Nessun pull/push/deploy.
Modifiche documentali altrui e next-env preesistente preservati, fuori dal commit
di questo lotto salvo il solo nuovo richiamo AI nel registro.

Quota conto osservata21% usato, ordinaryUsageAllowed=true; cap90/stop nuovi85
invariati. Nessun reset/acquisto/credito extra.

Nessun blocco residuo del lotto locale. Per attivare live restano da concordare
modello disponibile, limiti di spesa e autorizzazione esplicita di ambiente/test
live; autenticazione non collaudata. Prima del push futuro risolvere l'accesso Git
e verificare nuovamente la base remota. Le regole asset richiedono ulteriori
decisioni di prodotto. Il rapporto nativo torna alla regia per la sincronizzazione
tramite owner autorizzato; nessuna scrittura diretta al publisher.
