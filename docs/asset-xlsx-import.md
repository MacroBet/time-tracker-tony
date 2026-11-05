# Import asset Excel (.xlsx)

In **Assets → Import / export assets** si può scaricare un template Excel vuoto
oppure scegliere un file `.xlsx`, CSV o JSON. Il template Excel contiene soltanto
le19 intestazioni canoniche e colonne formattate come testo: nessun dato progetto,
esempio cliente, formula o macro. Il CSV rimane disponibile.

## Tabella supportata

- Un solo foglio nel workbook, visibile; intestazioni nella prima riga, senza
  celle unite. Per workbook con più fogli copiare quello desiderato in un file separato.
- Stesse colonne del CSV: `id`, `name`, `equipmentType`, `location`, `phase`, `floor`,
  `area`, `discipline`, `parentAssetId`, `serialNumber`, `owner`, `clientSupplied`,
  `levels`, `deliveryActivityId`, `expectedDelivery`, `levelActivities`,
  `programmeId`, `clientAssetId`, `programmeActivityId`.
- Le prime tre colonne e `levels` sono obbligatorie. Le altre possono mancare:
  il lettore comune conserva i campi opzionali dell'asset dello stesso ID.
  Una cella vuota in una colonna presente mantiene la semantica CSV di cancellazione.
- ID e altri campi testuali devono essere testo, preservando zeri iniziali e
  riferimenti. I valori numerici non vengono convertiti in ID. `levels` usa `;`
  e `levelActivities` conserva il formato oggetto JSON già previsto.
- `clientSupplied` accetta testo true/false, booleani Excel o vuoto, mantenendo
  la distinzione cliente/contractor/non classificato. `expectedDelivery` accetta
  testo `YYYY-MM-DD` o una cella data Excel intera: calendari1900/1904, senza
  frazioni orarie. Formati solo orario e il giorno fittizio29/02/1900 sono respinti.

Il parser segue le relazioni attive del pacchetto per workbook, foglio, stringhe
e stili; non usa parti orfane al loro posto. Supporta stringhe inline/condivise,
rich text e gli escape SpreadsheetML senza cambiare gli ID visibili.

## Anteprima e salvataggio

L'XLSX produce la stessa struttura asset del CSV e passa da `parseAssetRows`,
validazione, riferimenti e merge esistenti. Il file non importa un programma,
checklist o regole di sequenza e non ricava nuovi ID dai nomi. Nessuna scrittura
avviene alla scelta del file: prima anteprima, motivo e conferma, con versione,
membership, permessi e storico già presenti. Le date e baseline programma non
vengono ricalcolate da un import dei soli asset.

Limiti:8MB compressi,256 parti ZIP,16MB espansi per parte e32MB totali,
600.000 nodi XML/profondità32,19colonne e prime10.001righe fisiche, fino a10.000asset.
I limiti si applicano anche ai byte effettivamente decompressi. Fogli multipli o
nascosti, celle unite, formule con eventuali cache, link/connessioni esterni,
contenuti macro/embedded e dichiarazioni DTD/entity sono respinti. Incollare valori
nel template e rimuovere i collegamenti esterni prima dell'import.

Questo è un lettore della tabella asset, non un validatore completo di ogni
funzione OOXML. Compressioni ZIP supportate:store/deflate, senza multivolume/ZIP64;
la libreria non verifica CRC. Non esegue formule, macro o richieste di rete.
Il preflight dei workbook cliente rimane un rapporto separato di sola revisione.

## Dipendenze e prove

Parser caricato nel browser su richiesta: `fflate`0.8.3 e `fast-xml-parser`5.12.0,
entrambi MIT, fissati nel lockfile. Fonti primarie:
[ZIP e streaming](https://github.com/101arrowz/fflate),
[parser XML](https://github.com/NaturalIntelligence/fast-xml-parser),
[stringhe SpreadsheetML](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/working-with-the-shared-string-table).
L'installazione è locale al progetto, senza script di installazione, servizi o API live.

Il lotto5nov è verificato con11 casi XLSX sintetici, test di trasferimento/merge,
un workbook di10.000asset, controlli di file non validi e lettura indipendente del
template con openpyxl. Prove browser, build e limiti della consegna sono nel
[rapporto del lotto](tony-feedback/intake-20261105-xlsx-dashboard.md).
