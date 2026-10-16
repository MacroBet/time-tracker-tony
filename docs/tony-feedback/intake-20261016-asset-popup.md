# Tony — popup di aggiunta asset, 16 ottobre 2026

## Provenienza e copertura

Fonte: resoconto fidato della chat operativa **Show Chrome**, trasmesso al
coordinamento del progetto. La lettura riferita arriva alle **13:04 del
16 ottobre**. Le ore sono quelle mostrate da WhatsApp; il fuso della fonte non è
verificato. Questa nota non attesta una nuova lettura diretta della chat da parte
dell'agente che la scrive.

Nessun browser, WhatsApp o altro servizio è stato aperto per questa unità
documentale. Nessun messaggio, bozza nel composer o invio effettuato. Il precedente
invio autorizzato delle 12:10 rimane un evento separato; questi feedback non
autorizzano nuove comunicazioni.

## Fonti riferite

Le descrizioni sono parafrasi del resoconto. Le brevi etichette in maiuscolo
riportano i termini riferiti, senza attribuire loro una semantica ulteriore.

| ID                | Ora, 16 ottobre | Contenuto riferito                                                                                                                                       | Limiti                                                                                                                                           |
| ----------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| MSG-20261016-1241 | 12:41           | Tony invia `ADD PROJECT.xlsx`, indicato nell'interfaccia come 10 KB e un foglio, e chiede un popup per configurare i tag durante l'aggiunta di un asset. | Nuovo file non scaricato né analizzato; indicazioni di dimensione e fogli soltanto riferite dall'interfaccia. Nessun nuovo numero ATT assegnato. |
| MSG-20261016-1302 | 13:02           | Condivide una pagina Project come riferimento Microsoft Project, con playlist `Microsoft Project Tutorial Series`.                                       | URL non recuperato e pagina/playlist non aperte. Non sono stati verificati contenuti, lezioni, durata o funzioni del riferimento.                |
| MSG-20261016-1304 | 13:04           | Elenca `ASSET NAME`, `ASSET ID`, `PROJECT ID`, `GROUP`, `PHASE`, poi `ADD DATA`.                                                                         | Il significato di `ADD DATA` non è definito. L'elenco non precisa regole, valori obbligatori o comportamento dei gruppi.                         |

## Allegato non acquisito e disambiguazione

Show Chrome riferisce **un solo tentativo** di download del nuovo Excel:
finestra non disponibile, nessun dialogo lasciato pendente. Non ripetere tentativi
UI in questa unità. Il nuovo `ADD PROJECT.xlsx` resta **non acquisito e non
analizzato**: non vi sono percorso locale, byte esatti o SHA-256 verificati.

Il file già presente nella cartella è invece:

- **ATT-007**, messaggio **MSG-20261014-03**, 14 ottobre alle **15:29**;
- `attachments/2026-10-14_1529_ADD_PROJECT.xlsx`, **10.061 byte**;
- SHA-256 registrato nel [manifest](attachments/manifest.md):
  `50688595c3f8275334fb1bfc5847ac078bf04a53526641f582c64d86ab45794d`.

Verifica locale di questa unità limitata a nome/presenza e dimensione: risulta
soltanto quel vecchio file `ADD_PROJECT` fra gli XLSX con tale nome. Non è stato
aperto o analizzato nuovamente e non è stata calcolata una nuova impronta.
La somiglianza del nome e della dimensione non dimostra che sia lo stesso contenuto
del nuovo invio. ATT-007 non va rietichettato come allegato del 16 ottobre.
Il totale degli originali verificati nel manifest rimane **17**.

## Richiesta chiara e perimetro di implementazione coordinato

**Richiesta esplicita ricostruita:** nella creazione di un asset, presentare un
popup che includa la scelta/configurazione dei tag. Il riferimento a Microsoft
Project orienta il confronto funzionale; non richiede di implementare l'intera
playlist o tutte le funzioni di quel prodotto.

**Scelte di implementazione comunicate dal coordinamento root, da distinguere dai
messaggi di Tony:**

- Per un **nuovo asset**, popup con scelta dei livelli/tag già configurati nel
  progetto; anteprima e conferma nello stesso pannello.
- **Project ID** mostrato in sola lettura dal progetto corrente; **Phase** usa
  il campo già esistente. Nessuna nuova mappatura dai materiali non acquisiti.
- Il percorso di modifica degli **asset esistenti** resta invariato.

Questa nota registra il perimetro; non certifica che il popup sia stato
implementato, testato o distribuito. Stato e prove dell'implementazione vanno nel
[registro operativo](register.md#stato-corrente-per-ripresa).

## Interpretazioni e punti aperti

- **GROUP:** nessuna equivalenza automatica con `parentAssetId`. Gruppi nominati,
  appartenenza esplicita, schede condivise e conseguenze di aggiunte/rimozioni
  restano nel requisito **CX-009**, con regole ancora da definire. Il nuovo popup
  non autorizza propagazioni di risultati o approvazioni tra asset.
- **ADD DATA:** può indicare un'azione successiva, ma è soltanto un'interpretazione.
  Non sono definiti dati, allegati, colonne, destinazione o comportamento.
  Nessuna nuova funzione o estensione di perimetro viene dedotta da queste parole.
- **ASSET ID / PROJECT ID:** le etichette riferite non autorizzano rinominare gli
  ID interni o modificare collegamenti esistenti. Programme ID, Activity ID e
  Client asset ID restano distinti secondo il [contratto già implementato](../programme-identifiers.md).
- **Excel:** contenuto e differenze rispetto ad ATT-007 restano sconosciuti fino a
  una futura acquisizione autorizzata e verificabile. Nessuna formula o macro
  è stata eseguita e nessun dato è stato importato.

## Punto di ripresa

Per una futura richiesta esplicita di lettura, sovrapporsi ai messaggi riferiti
**12:41–13:04**, dichiarando eventuali intervalli non coperti. Non avviare polling
o altre automazioni; l'avvio rimane manuale e il heartbeat è PAUSED.

Per il nuovo Excel, il passo mancante è ottenere e verificare l'originale quando
la sessione lo consente senza interferire con Marco. Solo allora assegnare un nuovo
ATT con nome originale, percorso distinto, dimensione esatta, SHA-256 e limiti
reali dell'analisi. Non riusare ATT-007 come sostituto. Nessun test applicativo o
controllo UI dedicato eseguito da questo agente: l'unità è documentale.
