# Identificativi di programma, attività e asset

Tony ha confermato «Both required»: servono il riferimento del programma e
l'identificativo della singola attività. Chiarimento riferito direttamente da
Marco il 16 ottobre 2026; [fonte e contesto](tony-feedback/intake-20261016.md).

L'app conserva attualmente **un programma per progetto**. Il suo Programme ID è
un riferimento esplicito, separato dall'ID interno del progetto; ogni attività
registrata appartiene a quel programma e mantiene il proprio Activity ID.

| Campo                          | Significato                             | Collegamento                                              |
| ------------------------------ | --------------------------------------- | --------------------------------------------------------- |
| `project.id`                   | Identità interna del progetto           | Membership e isolamento dei dati                          |
| `commissioning.programmeId`    | Riferimento del programma del progetto  | Contesto comune delle sue attività                        |
| `schedule[].activityId`        | Identità della singola attività         | Date, baseline, predecessori e task già esistenti         |
| `assets[].id`                  | Identità interna stabile dell'asset     | Chiave di aggiornamento nei reimport e dei legami ai task |
| `assets[].clientAssetId`       | Riferimento asset del cliente           | Metadato distinto, non una chiave di deduplica            |
| `assets[].programmeActivityId` | Attività principale collegata all'asset | Deve esistere nel programma dello stesso progetto         |
| `assets[].deliveryActivityId`  | Attività della consegna                 | Legame distinto dall'attività principale                  |
| `assets[].levelActivities`     | Attività per ciascun tag/livello        | Conserva i collegamenti delle schede tag                  |
| `task.cx.activityId`           | Attività cui è collegato il task        | Mantiene il calcolo della sua scadenza programma          |

Non si rinominano gli ID già referenziati né si ricavano i nuovi campi dal nome
dell'asset o dall'Excel. I dati precedenti restano validi; i riferimenti mancanti
sono mostrati come non registrati. Le fixture locali usano valori dichiaratamente
DEMO, senza cambiare i vecchi dati p1 o eseguire seed remoti.

## Utilizzo

In **Programme**, Set/Edit Programme ID permette di inserire il riferimento,
indicare un motivo, vedere prima/dopo e confermare la revisione. Una versione
progetto cambiata richiede una nuova anteprima. Manager, supervisor e admin con
Commissioning possono gestirlo; il worker non può modificarlo.

In **Assets**, l'ID interno rimane stabile durante l'edit. Client asset ID è
separato e il Programme ID viene mostrato dal progetto. Programme Activity ID
seleziona una delle attività registrate; consegna e collegamenti per tag restano
controlli distinti. Scegliere un'attività principale non assegna risultati,
approvazioni o scadenze ai task già collegati ad altre attività.

Task, moduli di modifica e report mostrano il contesto Programme ID insieme
all'Activity ID pertinente. I CSV dei report includono il riferimento programma;
gli aggregati non ricevono un Activity ID inventato.

## CSV, JSON e compatibilità

Il CSV asset include `programmeId`, `clientAssetId` e `programmeActivityId`.
Programme ID è metadato di progetto ripetuto sulle righe: valori non vuoti
discordanti sono rifiutati. Colonna assente o interamente vuota conserva il
Programme ID esistente. Per cancellarlo usare il controllo Programme oppure
un `programmeId:""` esplicito in JSON.

Per i nuovi riferimenti asset, colonna/chiave assente conserva il valore
precedente; stringa vuota esplicita lo cancella. Il reimport usa sempre l'ID
interno: riferimenti cliente e nomi ripetuti non vengono deduplicati. I normali
controlli su livelli, parent e attività continuano a valere. Un'attività può
essere aggiunta e collegata nello stesso import, con verifica sull'insieme finale.

Il JSON del registro conserva il Programme ID alla radice, per esempio:

```json
{
  "programmeId": "DEMO-PROGRAMME-01",
  "assets": [],
  "schedule": []
}
```

È ammessa anche una revisione del solo metadato. Cambiare Programme ID o soli
riferimenti asset non ricalcola le date e non normalizza baseline legacy;
l'aggiornamento effettivo del programma resta un'operazione distinta. Ogni
salvataggio usa versione, permessi e storico esistenti nel JSON del progetto.
Nessuna nuova migrazione SQL è richiesta per questi campi.

Questa estensione non implementa più programmi nello stesso progetto, una
sincronizzazione P6 o le regole dei gruppi CX-009. Il ciclo di sviluppo verifica
soltanto la demo locale e non scrive nel database remoto.
