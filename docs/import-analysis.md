# Report issue AMS16

Fonte: `Issue Report 2026-09-05-202609050824.xlsx`, foglio `Issues`, intervallo `A1:AF306`. Analisi in sola lettura del 12 settembre 2026. Il file originale non è stato modificato né copiato nel repository.

Il report contiene 305 righe con 305 ID distinti. Il progetto nell’Overview è `EDC3 - NL1.0030 - DLR AMS16`.

| Assegnazione originale | Issue |
| ---------------------- | ----: |
| Persona                |   150 |
| Azienda                |   146 |
| Ruolo                  |     9 |

La colonna `Company name` è vuota per 155 righe. Il nome dell’assegnatario non è un identificativo di accesso: occorre una mappatura esplicita agli account, senza inventare email. Le assegnazioni aziendali e per ruolo devono restare distinguibili da quelle personali. Tony McIntyre compare associato a Digital Realty, mentre la demo usa un’associazione sintetica ad alternativeHEAT.

| Stato originale  | Issue |
| ---------------- | ----: |
| Open             |   213 |
| Ready to inspect |    65 |
| In dispute       |    18 |
| Answered         |     4 |
| Work completed   |     4 |
| Not approved     |     1 |

`Ready to inspect` e `Answered` non dimostrano una chiusura approvata. Prima dell’import, conservare lo stato sorgente e definire la sua relazione con il workflow operativo; evitare conversioni automatiche a `completed`.

31 issue hanno tipo Commissioning P1, 192 Commissioning P2. Le altre 82 appartengono a EHS, Quality, Risk, Design e Observation: il report non ne specifica una priorità P1/P2/P3, che quindi non va presentata come dato originale.

L’importatore dovrà proporre un’anteprima con riferimenti alle righe e segnalare le mappature mancanti. Conservare ID esterno, descrizione, date, ubicazione e metadati sorgente, deduplicando per progetto, sorgente e ID. Le colonne sulle associazioni a documenti/checklist non contengono i relativi file: non possono diventare automaticamente evidenze caricate.

Stato attuale: analisi completata, nessuna riga importata. Il database di test contiene lo schema dell’app, senza dati demo.
