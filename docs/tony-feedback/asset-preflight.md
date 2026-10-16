# Preflight locale della lista asset

DATA-002 produce un rapporto di revisione ripetibile dalla sorgente
`Simplified list`. Non produce un registro importabile e non legge configurazioni
o credenziali dell'app. Non contatta il database e non modifica il workbook.
Contesto e richieste: [intake del 16 ottobre](intake-20261016.md).

## Esecuzione

Richiede Python e `openpyxl`, già usati dagli estrattori del progetto. In Codex
usare il Python restituito da `load_workspace_dependencies`. Dalla cartella del
progetto, con quel runtime al posto di `python3` se necessario:

```sh
python3 scripts/preflight-assets-xlsx.py \
  'docs/tony-feedback/attachments/2026-10-15_2041_Example Asset List (Match Formatting).xlsx' \
  output/asset-preflight/att-014.review.json
```

Il percorso di uscita deve essere nuovo e terminare in `.review.json`; un file
esistente non viene sovrascritto. Il rapporto contiene valori privati: conservarlo
in `output/`, già ignorato da Git. Gli originali restano nell'archivio privato.

## Contenuto e interpretazione

- File, SHA-256, foglio, intestazioni e numero di riga conservano la provenienza.
  I valori rimangono quelli della sorgente, inclusi i metadati non mappati.
- Una riga candidata ha almeno un campo di classificazione core compilato, oltre
  al solo nome. Le righe parziali restano candidate con i campi mancanti elencati;
  le righe con solo nome/note sono separate per revisione. Non sono dichiarate
  automaticamente asset validi.
- Il confronto nomi usa soltanto trim e distingue maiuscole/minuscole; ogni
  collisione riporta tutte le righe. Anche i duplicati esatti rimangono nel report.
  Nessuna deduplica o identità interna viene scelta.
- Testo delle formule e cache salvate sono separati. Le cache sono indicate come
  non verificate, senza esecuzione o ricalcolo. Zero e false restano valori presenti.
- Non si inferiscono livelli, piano, gruppi, riferimenti cliente/programma,
  approvazioni o completamento. Il rapporto riporta le decisioni ancora richieste.
- Il contratto è `fieldtrack-asset-preflight-v1`, con `reviewOnly:true` e
  `importAllowed:false`; non contiene le collezioni `assets`/`schedule` dell'import.

## Verifica su ATT-014

La sorgente A1:P25466 include coda di celle vuote: il numero fisico di righe non
è il numero di asset. Risultato riconciliato con l'analisi indipendente:

| Controllo                                  |     Risultato |
| ------------------------------------------ | ------------: |
| Righe candidate                            |         1.354 |
| Nomi distinti dopo trim                    |         1.164 |
| Nomi ripetuti                              |           179 |
| Righe eccedenti rispetto ai nomi           |           190 |
| Gruppi di righe completamente identiche    |             0 |
| Righe non asset conservate separatamente   | 1 (nota A705) |
| Righe vuote nell'intera estensione         |        24.110 |
| Righe candidate con campi core mancanti    |             0 |
| Abbreviazioni / descrizioni / stanze vuote |  68 / 42 / 71 |
| Formule nella sola sorgente selezionata    |         1.604 |

Il valore FR letto dalla cache non sostituisce la Design phase numerica, che
rimane un campo separato. Nessuno stato del template ACC diventa approvazione
FieldTrack. Le altre tre schede non vengono sommate alla lista sorgente.

Test sintetici del classificatore:

```sh
python3 -m unittest discover -s tests -p test_asset_preflight.py -v
```

Sette test coprono collisioni, note/coda vuota, zero/false, campi mancanti,
formule senza cache, duplicati esatti e intestazioni errate. Sul file privato sono
verificati conteggi, provenienza, hash invariato, report ripetibile e rifiuto della
sovrascrittura. Non è un collaudo di import o del database.
