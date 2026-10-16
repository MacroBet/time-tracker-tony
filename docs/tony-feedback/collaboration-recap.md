# Recap ragionato della collaborazione con Marco

Sintesi al 16 ottobre 2026. Fonte: istruzioni/correzioni di Marco conservate nel
[registro](register.md), fonti indicizzate e resoconto operativo della chat che
ha seguito Marco, trasmesso il 16 ottobre. Non è un dump del trascritto né una
nuova lettura diretta di WhatsApp. Lo [stato corrente](register.md#stato-corrente-per-ripresa)
prevale su proposte e autorizzazioni storiche. Le [lezioni](working-lessons.md)
indicano cosa riusare e con quale ambito.

## Obiettivo e cambi di direzione

FieldTrack nasce come app di costruzione e commissioning, con Tony McIntyre
referente e Marco responsabile di scelte e comunicazioni. Screenshot, Excel e
prototipi ZIP hanno aiutato a capire il lavoro reale. Marco ha chiesto di portare
avanti l'app esistente e produrre miglioramenti utilizzabili: non sostituire il
backend con i pacchetti di Tony. Next/React e Neon/Drizzle restano lo stack.

Il programma ufficiale deve vivere nell'app. P6 e MS Project sono riferimenti
funzionali/visivi, senza sincronizzazione da attivare. Sono stati sviluppati
Gantt persistente con date, baseline e dipendenze, albero compatto espandibile,
asset/tag/schede test, storico, dashboard e team. I/R/AC/A sono etichette esplicite:
le regole approvative del cliente restano da definire. I test non approvano i tag.

Marco ha corretto l'esperienza iniziale: vuole capire subito dove andare e vedere
esempi rappresentativi, insieme a stati vuoti guidati. Ne sono derivati quattro
percorsi principali Overview → Programme → Assets → Tasks e la demo locale
Northbank ricca, distinta dal progetto vuoto e dai dati reali. Le fixture non sono
state caricate in produzione e gli Excel sono stati analizzati, non importati
automaticamente. Le fonti restano private con manifest versionato.

Il passo AI concordato è un assistente utile sui dati del progetto: prima copilot
che consulta e propone azioni controllabili, eventuale autopilot futuro con regole.
Marco ha autorizzato l'impalcatura prima della chiave, che fornirà lui più avanti.
Sono consegnati controlli deterministici, esempi e proposte task con anteprima e
conferma. Il provider live resta disattivato; Codex non è il backend collegato.
Il vantaggio da spiegare è l'aiuto concreto sul lavoro, non la mera vendita di API.

Tony ha risposto «No probs» alla proposta di €1.000 aggiuntivi per il lavoro AI
(MSG-20261015-2016 nel registro). È assenso commerciale, non prova di pagamento
o budget API. Importo e primo compenso storico non sono un listino universale;
il primo pagamento non è verificato con certezza.

## Correzioni nel modo di collaborare

Marco preferisce azione concreta, prove e risultati a promesse. Comunicare in
italiano, in modo breve e amichevole; spiegare cosa è pronto e cosa resta aperto.
Non ripetere domande già risolte da contesto o materiali. Mostrare il risultato
nel Chrome visibile quando lo chiede, rispettando la sessione desktop.

Con Tony, inglese colloquiale e messaggi brevi separati; adeguare le parole al testo
voluto da Marco prima dell'invio. Ci sono state autorizzazioni temporanee più ampie,
poi revocate. **Oggi ogni messaggio esterno richiede approvazione del testo concreto**;
composer solo su richiesta esplicita. I singoli invii approvati sono conclusi e
non autorizzano quello successivo. La preparazione di una bozza non prova un invio.

Il 16 ottobre Marco ha riferito il chiarimento «Both required»: programma e singola
attività richiedono entrambi un ID. CX-010 li ha separati e collegati, aggiungendo
Client asset ID senza rinominare ID interni o alterare task/tag/date/baseline.
Prove: 86 test unitari/PostgreSQL, 10 API, statici/build e desktop/mobile passati;
commit applicativo `77b74d7`, deploy Vercel success verificato, chiusura documentale
`58a548f` su main. Prova autenticata esclusivamente locale, non su Production.

Aggiornamento riferito dalla chat operativa del 16 ottobre: ultimo Tony visibile
«Both required» delle 10:01; alle 12:10 Show Chrome ha inviato una volta, su richiesta
esplicita di Marco: «Done Tony, both IDs are in now, programme and activity, separate
and linked. Tested and deployed.» Testo concluso, non una bozza pendente. Le ore sono
quelle riferite/visualizzate; il fuso della fonte WhatsApp non è verificato.

## Scelta attuale: continuità su richiesta

Il 15 ottobre Marco aveva scelto heartbeat ogni 15 minuti; il 16 ottobre ha cambiato
modalità per evitare consumo AI periodico inutile. È ora **PAUSED**, confermato nei
metadati locali. Nessun polling, risveglio o lavoro autonomo dopo il turno. Qualsiasi
nuova chat nella cartella recupera indice, stato e dettagli necessari tramite
AGENTS.md. La continuità è nei documenti verificabili, non nella promessa di memoria
perfetta o nella dipendenza dall'identità di un modello o da una vecchia chat.

Marco vuole anche conservare i modi di lavorare insegnati durante processi riusciti.
Le lezioni nuove si registrano incrementalmente nel progetto; la skill generale
[capture-working-lessons](../../tools/skills/capture-working-lessons/SKILL.md)
contiene il metodo, senza trasferire dati Tony a progetti estranei.

## Cosa resta aperto

Gruppi nominati e task/schede condivisi: definire identità, membri, esiti per membro,
approvazioni ed effetti delle aggiunte/rimozioni prima di propagare stati. Altri
chiarimenti funzionali sono nel backlog. Nessuna nuova domanda sugli ID è necessaria.
Target DB Production, isolamento, dry run/idempotenza, rollback e nuova approvazione
restano necessari prima di qualsiasi popolamento; il precedente blocco auto-review
non va aggirato. Il sito è [time-tracker-tony.vercel.app](https://time-tracker-tony.vercel.app),
ma il dominio non identifica il branch Neon. Setup chiave AI rinviato a Marco,
nessuna chiamata live o a pagamento autorizzata ora.
