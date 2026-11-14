# FieldTrack - cronologia chat DB, Markdown e attesa inline, 14 novembre 2026

## Mandato diretto e perimetro

Marco richiede fix urgente e push in produzione: lista delle chat passate,
rendering Markdown (in particolare bold), invio non bloccante con caricamento
interno alla conversazione e comparsa progressiva del testo. Alla domanda sul
tipo di persistenza risponde esplicitamente **«salvale su db»**. La proposta di
cronologia locale viene quindi sostituita; nessun archivio localStorage resta.

Baseline `ace0530` (un commit documentale locale sopra origin/main `3917024`),
fetch riuscito; nessun pull/reset/stash. Modifiche altrui preservate ed escluse.
Quota nativa iniziale20%, ordinaryUsageAllowed=true; cap90/stop nuovi85 invariati.

## Implementazione pronta

- Storico privato per account e progetto su nuova tabella dedicata, elenco paginato,
  riapertura tramite identità URL, New chat ed eliminazione con conferma UI.
  Autorizzazioni fresche per ogni richiesta e dentro gli statement SQL; versione
  CAS e retry idempotente sia di create sia di update. Stesse chat tra sessioni.
- Sono salvati solo testo/ruolo/identità messaggi e filtri report scoped, con
  limiti dichiarati. Mai token, proposte confermabili, azioni o snapshot di dati.
  Le risposte riaperte sono snapshot; report correnti riaperti tramite link.
- Markdown AST verso React, senza HTML attivo o nuove dipendenze: bold, italic,
  paragrafi, titoli, liste, quote, codice, link validati e tabelle. Nessun fetch
  automatico di immagini. Link javascript/data e HTML eseguibile esclusi.
- Indicatore di attesa nel messaggio Assistant, composer editabile per la domanda
  successiva, navigazione/New chat disponibili, Stop waiting senza promesse di
  interrompere il lavoro server. Risposta completa presentata progressivamente,
  con preferenza reduced-motion rispettata; trasporto provider invariato.
- Domanda salvata prima dell'invio AI; risposta salvata dopo l'arrivo. Errori non
  cancellano la domanda né il testo scritto nel frattempo. Retry del solo
  salvataggio non richiama il provider. Risposte tardive non entrano in altre chat.

## Piano concreto per la sola migrazione0007

**Stato: piano approvato direttamente da Marco il14novembre2026; esecuzione
remota autorizzata.** Apply e deploy vengono attestati separatamente sotto.

Target unico: database già configurato nella **Production** Vercel del progetto
`macrobets-projects/time-tracker-tony`, project ID
`prj_hqtnQUnlqpG0tpjFM49p0Q73m9Vz`, team
`team_h8XmGMkuuV40uY9S8M7s0rmy`, alias
`https://time-tracker-tony.vercel.app`. Nessuna promozione di un .env locale a target.

Unico DDL: `drizzle/0007_assistant_conversations.sql`, SHA256
`61f56fda1caa931116e3584611b237d0e00e33396145e3d7680026317a5dc14b`,
journal timestamp1794672000000. Crea solo assistant_conversations, indice privato,
vincoli e sua riga nel journal. Nessuna modifica a task, assegnazioni, asset,
programma/P6, membership, ruoli, chiavi o configurazione provider.

1. Verificare account/progetto e soli nomi delle env Production. Nessun gate
   migrazione concorrente. Configurare esclusivamente il gate monouso non segreto
   `FIELDTRACK_CHAT_MIGRATION_APPROVAL`, collegato alla risposta di Marco.
2. Normale commit/push autorizzato. Nel build esatto il runner usa solo DATABASE_URL
   già iniettata da Vercel; verifica Production/project ID/alias prima del client.
   Nessun dotenv, UNPOOLED alternativo, nuova connessione o segreto recuperato.
3. Preflight readonly su storico esatto0000-0006, baseline ruoli/moduli e tabella
   assente. Checksum diverso, gap, tabella non tracciata o drift fermano l'apply.
4. Lock e transazione atomica con ricontrollo storico, solo0007 e journal, verifica
   schema effettivo nella stessa transazione e postflight readonly. Seconda
   esecuzione con schema coerente è no-op. Nessun migrate generale o SQL arbitrario.
5. Build/deploy solo dopo successo; verificare SHA e Production effettivi e alias.
   Rimuovere il gate dopo la riuscita e distribuire la stessa release senza gate.
   Nessuna prova AI live o import dati cliente durante la verifica.

Rollback conservativo: tornare alla release applicativa precedente, rimuovere il
gate e conservare nuova tabella/journal/chat. Nessun DROP o cancellazione dati.
La transazione annulla DDL/journal se un controllo interno fallisce. Le chat
precedenti a questo rilascio, mai persistite, non vengono inventate o recuperate.

Motivo della conferma finale: [AGENTS.md](../../AGENTS.md) richiede per scritture DB
remote «target esatto, isolamento, dry run, idempotenza, rollback e nuova
approvazione del piano». Il precedente blocco auto-review non viene aggirato.

## Prove locali e pubblicazione

282 test unitari/PostgreSQL e16API passati; lint, typecheck e build produzione PASS.
Dry run/apply/no-op/rollback/race/drift testati esclusivamente su PGlite, preservando
le tabelle esistenti. Browser desktop/mobile PASS:33assert e12schermate nella conferma finale, nessun
errore runtime, overflow o controllo visibile senza nome/sotto44px rilevato.
Ripristino da seconda sessione, Markdown, digitazione durante attesa, errore/retry,
risposta tardiva su altra chat e retry salvataggio senza seconda queryAI verificati.
Un solo batch di correzione (singolare message e memo rendering), poi conferma.
Nessuna chiamata provider reale.
Evidenze private in output/tony/chat-ux-20261114 e output/playwright/chat-ux-20261114.
CLI Vercel inizialmente senza sessione; login rinnovato come macrobet e progetto
Production verificato. Nomi env confermati senza leggere i segreti: nessun gate
migrazione residuo. Prima del consenso non erano stati impostati gate/env Production né avviati
apply o deploy. Approvazione specifica acquisita nella risposta diretta sotto.

## Approvazione specifica acquisita

Risposta diretta Marco alla domanda strutturata
`call_696654d2a0444e3ca1800d69c121000a`, item0:
**«Autorizzo migrazione 0007 e deploy»**. Il testo della domanda identifica
DB Production time-tracker-tony.vercel.app, sola tabella privata cronologia e
journal, preflight, transazione, conservazione task/asset/P6/permessi e rollback
applicativo senza DROP. Gate Config monouso associato a questa risposta:
`chat-0007-call_696654d2a0444e3ca1800d69c121000a-0`.

Account CLI macrobet, progetto/team esatti e assenza di gate residui verificati
prima dell'esecuzione. Uso esclusivo di DATABASE_URL già iniettata nel build
Production; nessun segreto letto o nuovo provider. Esiti effettivi sotto, distinti
dalla sola approvazione.

## Applicazione e pubblicazione verificate

Codice `9e7eeb9`, approvazione `4a083e4ba1befb7e6f8182d0b19f0d5aad6207fb`,
push normale su main. Build Production esatto
`time-tracker-tony-64tlbzyzv-macrobets-projects.vercel.app`.
Il runner nel build ha emesso `state:applied` il14novembre2026 alle
18:49:41.964UTC (19:49:41Europe/Rome), targetProduction e SHA0007 esatti.
Questo esito richiede preflight readonly0000-0006, commit atomico0007+journal,
verifica schema dentro transazione e postflight readonly riusciti. Nessun SQL
amministrativo generale, nuovo ruolo, seed o cambio a record cliente.

GitHub Vercel success e deployment Production **7792232649** success sullo stesso
SHA,18:50:32UTC. Alias pubblico HTTP200 e nuova route cronologia HTTP401 senza
sessione verificati in sola lettura. Collaudo autenticato/salvataggi rimangono
le prove locali; nessuna queryAI o nuova chat cliente creata dal smoke pubblico.

Gate Config `FIELDTRACK_CHAT_MIGRATION_APPROVAL` rimosso dopo la riuscita; elenco
Production ricontrollato: nessun gate chat/meter presente, stesse cinque variabili
preesistenti preservate e nessun valore segreto letto. Pubblicazione del presente
registro attiva lo stesso codice applicativo senza gate; ricevuta dello SHA finale
e log build ordinario custoditi privatamente come production-final-release e
production-final-build, senza ulteriori scritture migratorie.

Cronologia operativa dalle nuove chat: quelle mai salvate prima del rilascio non
sono recuperate o inventate. Markdown e attesa/progressione sono presentazione
client del risultato, non cambio del provider o promessa di streaming API live.
Modifiche preesistenti e next-env preservati; nessun invio esterno.
