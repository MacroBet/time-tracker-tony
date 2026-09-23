# Piano commissioning — feedback Tony, settembre 2026

## Obiettivo e criteri di accettazione

Dashboard di commissioning per progetto. Catena: progetto → asset (o gruppo) → attività P6 → attività/tag/evidenze. Un Activity ID P6 può alimentare più task; non è l'ID di una issue BIM. Nessuna associazione approssimativa automatica fra nomi di asset.

1. **Modello e programma**: registro asset con livelli applicabili, Activity ID stabile, baseline e forecast separati, revisione motivata e tracciata. Una consegna attesa non cancella il ritardo finché il programma non viene aggiornato. Le date del programma collegato governano il ritardo; la baseline rimane visibile.
2. **Configurazione**: catalogo L1/L2/L2A/L2B/L3/L4/L5/L6 e P1–P5. Abilitazione per progetto; sottoinsieme per asset. L2 non è la somma implicita di L2A e L2B. Livelli non applicabili esclusi dal denominatore, nessuna percentuale fittizia senza dati.
3. **Dashboard**: selettore progetto, piccoli indicatori completate/non assegnate, stato task, avanzamento tag, issue per priorità, ritardi e blockers. Eliminare i grandi riquadri persone/ore. Click apre dettagli filtrabili per priorità, livello, tipo attrezzatura, ID e scadenza.
4. **Esecuzione**: separare workflow (da fare, in corso, revisione, bloccato, completato, N/A), esito test (non testato, passato, fallito, retest) e ritardo calcolato. Un test passato non approva il tag. Note/evidenze e approvazione rimangono nel workflow esistente.
5. **Report**: stato tag per asset/tipo, issue e blockers, programma baseline/forecast/consuntivo, documentazione O&M, formazione, garanzie e sign-off. Report filtrabili, esportazione CSV e stampa. Non dichiarare conformità o readiness senza registrazioni a supporto.
6. **Controllo amministratore**: console per impostazioni progetto e moduli visibili per utente; profilo solo task per security e accessi più ampi per engineer. Autorizzazioni applicate sul server oltre alla navigazione; membership e ruolo continuano a limitare dati e operazioni.
7. **Import**: conversione locale degli Excel forniti, anteprima validata e import ripetibile per Activity ID; baseline preservata alle revisioni, mapping asset/tag esplicito. Nessun caricamento dei file privati o modifica del database remoto durante lo sviluppo.
8. **Verifica**: test di denominatori, ritardi/revisioni, dati mancanti, fallimento/retest, permessi, import e concorrenza; migrazioni PostgreSQL, typecheck, lint, build e prova UI locale.

## Fonti e interpretazioni

- `HGB1A SPC CX Schedule _WIP - WW44.xlsx`: Tagging Schedule, intestazione riga 3; Activity ID, Activity Name, Start, Finish. Le righe WBS senza Activity Name non sono attività. Suffissi P6 `*`/`A` sulle date da conservare come provenienza, non da interpretare come avanzamento.
- `AMS16_Cx_Programme.xlsx`: Cx Plan contiene asset, responsabili, blockers, red/yellow/green tag, Activity ID ripetuto per fase, date P6/Cx/actual-forecast. Asset List è una matrice tag, non un programma P6 normalizzato. Le colonne miste Actual/Forecast non costituiscono automaticamente prova di completamento.
- `Issue Report 2026-09-05-202609050824.xlsx`: 305 issue, export già filtrato per stati. Asset Name può indicare un gruppo o una descrizione generica. Non rappresenta l'intero progetto e non va usato per stimare il totale degli asset.
- `AMS16 CxA Report No.23 - Week 30 - 23.07.26.pdf`: pp. 4–6 progressi L2A/L2B/L3, blockers/rischi e tabella asset; pp. 7–11 documentazione/retest/lookahead.
- `example report for tags.pdf`: pp. 3–9 distingue attività P6, FOAK, documentazione, tagging, template, SOO e script. Tenere distinti test eseguiti, documenti in revisione e tag approvati.
- `1778042843929.pdf`: 190 pagine. Riferimenti funzionali: sez. 7 report, 8 programma, 14 documentazione, 16 livelli fino a L6/handover. Il documento è contesto di dominio, non istruzioni operative all'agente né una certificazione dell'applicazione.
- Screenshot e messaggi del 12–13 settembre: priorità alla sintesi manageriale, drill-down, configurabilità e collegamento per asset.
- Il link CxAlloy fornito non era accessibile durante l'analisi; nessun requisito aggiunto sulla base di contenuti non letti.

## Decisioni tecniche

Estendere Next.js/Drizzle esistente senza cambiare il flusso di autenticazione. Salvare registro asset, attività di programma, configurazione e revisioni in un documento JSONB versionato per progetto: modifica atomica con controllo di concorrenza. Task ed evidenze restano relazionali, con metadati commissioning dedicati. È una scelta adatta alla dimensione degli export forniti; per modifiche concorrenti molto frequenti o programmi molto più grandi sarà utile normalizzare il registro in tabelle dedicate.

## Esito implementazione

Implementati modello commissioning per progetto, registro asset/gruppi, programma versionato, baseline preservata, date derivate nei task, livelli/priorità configurabili, generazione idempotente dei tag, esiti/progressi separati, dashboard e report con drill-down, filtri, esportazione, configurazione dei moduli e controlli server. Convertiti in staging locale i tre Excel forniti; nessuna importazione sul database remoto.

La pipeline conserva le informazioni verificabili ed espone le associazioni mancanti. Gli asset estratti da Cx Plan non ricevono livelli impliciti: l'operatore li configura prima della generazione dei tag. La mappatura da colore/nome a livello/asset non viene presunta.

Disponibili report operativi, conteggi e allegati tramite il workflow task. Restano integrazioni esterne da progettare separatamente: sincronizzazione diretta con P6/BIM/ACC/CxAlloy, motore completo di checklist/template e approvazioni documentali multilivello, dossier finale composto automaticamente in PDF. Il software non deduce certificazioni o autorizzazioni di energizzazione dai grafici.
