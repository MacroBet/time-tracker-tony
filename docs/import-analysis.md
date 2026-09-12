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

## Importazione completata

Il 12 settembre 2026 sono state importate 305 issue nel progetto `AMS16 · Test` di Neon. Tutte le 32 colonne sono conservate in `import_data.fields`, con file e riga sorgente. La riconciliazione ha verificato ogni riga; ripetendo il comando, tutte le 305 issue sono state saltate senza duplicati o sovrascritture.

Il workflow iniziale mappa Open → To do, Ready to inspect / Answered → In progress, In dispute / Not approved → Blocked, Work completed → Completed. Lo stato originale è sempre visibile separatamente come snapshot del report. Non viene inventata una data di completamento né dichiarata una chiusura approvata. Le 82 priorità mancanti restano nulle.

Le 30 denominazioni aziendali sono mantenute distinte, senza fondere automaticamente nomi simili. Le 9 assegnazioni al ruolo TEAM-MER-Commissioning sono sotto `Company not mapped`: il report non ne esplicita l’azienda. Non sono stati creati account per le persone dell’export. Le issue conservano l’assegnatario esterno. Nel successivo collaudo operativo, 12 issue sono state assegnate al worker principale e 6 al secondo worker tramite la nuova API, con storico esplicito e stati originali conservati. Manager, admin e supervisor vedono i progetti loro assegnati; ogni worker vede solo le proprie attività.

I timestamp senza offset sono interpretati nel fuso Europe/Amsterdam. Le stringhe originali restano nei metadati. I documenti e le checklist associati non sono allegati nel workbook e non sono stati importati.

### Ripetere l’importazione

1. Usare Python con `openpyxl`: `python3 scripts/extract-issues.py report.xlsx output/import/issues.json`.
2. Anteprima: `node --import tsx scripts/import-issues.ts --file output/import/issues.json --project PROJECT_ID --actor admin@test.com`.
3. Aggiungere `--apply` per salvare. Il comando valida l’intero input e la membership dell’account manager/admin, poi inserisce aziende, issue e storico in una singola transazione. Le issue già presenti non vengono aggiornate. I file temporanei in `output/` sono esclusi da Git.
