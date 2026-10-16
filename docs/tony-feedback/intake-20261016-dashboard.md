# Dashboard Tony — 16 ottobre, 12:24–12:31

Fonte: report finale del subagente Show Chrome trasmesso dalla chat operativa.
Ha letto **otto nuovi messaggi** Tony e visualizzato gli screenshot; questo agente
ha ispezionato soltanto i tre PNG locali e ne ha verificato byte/SHA-256 e ignore Git.
Non è una lettura diretta WhatsApp di questo agente. Ore visualizzate/riferite,
fuso della fonte non verificato. Nessun messaggio o bozza inviati nella raccolta.

| Fonte                                                 | Richiesta esplicita / riscontro                                                                                       | Limite                                                                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| MSG-20261016-1224a / ATT-015                          | Tasks by status in alto pagina, accanto a un riepilogo                                                                | 305 task è un numero della figura, non dato importato                                                                          |
| MSG-20261016-1224b / ATT-016                          | Project Health come esempio del riepilogo accanto                                                                     | 12 Projects, 8/3/1 sono esempi; ambito e formula On/At/Off Track non definiti                                                  |
| MSG-20261016-1228a / ATT-017                          | Issues by priority con percentuale task completati e numero late                                                      | Non inferire una fase da una priorità né importare numeri dell'immagine                                                        |
| Messaggi 12:28–12:30, Programme overview visualizzato | Stesse informazioni per le fasi, late accanto alla percentuale; possibile TOTAL/COMP/LATE interattivo con hover/click | L1/L2A/L2B/Energisation Gate/L3/L4/L5/IST sono etichette del riferimento, non nuovi livelli o legami automaticamente approvati |
| Messaggio 12:31, Overdue visualizzato                 | Spostare Overdue as of today fuori dalla dashboard in una lista separata                                              | Screenshot 12.30.52 non salvato, nessuna identità file/hash attestata                                                          |

## Acquisizione parziale degli allegati

Tre originali salvati e verificati: ATT-015/016/017 nel [manifest](attachments/manifest.md).
Programme overview potrebbe essere stato proposto come salvataggio, ma il file
`2026-10-16_1228_tony_programme-overview_original.png` è assente al controllo locale.
Overdue non confermato salvato. Non dichiarare cinque allegati acquisiti: Show
Chrome ha interrotto per errore ripetuto di cattura schermo mentre Marco usa il
computer. Nessun tentativo UI aggiuntivo da questa unità; nessun accesso in parallelo
al browser visibile. La copertura testuale riferita arriva alle 12:31.

## Interpretazione implementata e contratto verificabile

La dashboard resta sul progetto corrente, entro membership e permessi esistenti.
Tasks by status è compatto e in alto, accanto a Project summary su dati salvati.
Project Health resta una pendenza esplicita: nessun rating o formula costruiti.

TOTAL comprende i task salvati del sottoinsieme, inclusi N/A. COMP conta soltanto
workflow `completed`; la percentuale è COMP / task applicabili (N/A esclusi),
arrotondata, oppure “—” se non ci sono applicabili. Non è approvazione del tag:
I/R/AC/A e conteggi di approvazione restano nei riepiloghi tag separati.

LATE riusa `isOverdue`: task aperto, data `scheduleDueDate ?? dueDate` precedente
alla data progetto in Europe/Amsterdam. Oggi non è late; completati, N/A e task
senza scadenza sono esclusi. È il ritardo corrente, non il numero di record chiusi
in passato in ritardo. Le date programma salvate prevalgono sui deadline originali;
non si deducono nuove associazioni da nomi, colori o riferimenti asset primari.

Programme overview raggruppa per `cx.level` esplicito e livelli abilitati del progetto.
Le etichette/colori già configurati restano. Nessun mapping Energisation Gate/IST
inventato; task senza fase e record tag mancanti non sono assegnati implicitamente.
Issues by priority usa `taskKind` e priorità salvata, incluse quelle disabilitate
ancora presenti nei dati; issue senza priorità restano nel registro completo.

Ogni contatore è un pulsante con hint al passaggio e nome accessibile; click,
tastiera e touch aprono la lista filtrata corrispondente. Le percentuali aprono i
completati. La pagina `/overdue` contiene ricerca, priorità, paginazione e stato
vuoto, con accessi dalla dashboard e navigazione secondaria/More mobile. Le quattro
destinazioni principali restano uguali. Nessuna modifica di dati, seed remoto,
provider AI, autopilot o altri repository.

Prove e consegna effettive nel [registro corrente](register.md#stato-corrente-per-ripresa).
