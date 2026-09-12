# Flussi operativi e copertura

Aggiornamento del 12 settembre 2026, dopo il collaudo con le 305 issue reali. Questa matrice descrive i flussi implementati, non una promessa di copertura universale o di integrazioni ancora prive di credenziali.

| Ruolo             | Flusso disponibile                                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Worker            | Vede soltanto le proprie attività nei progetti assegnati. Viste To do, In progress, To review, Blocked, Completed e All con conteggi. Ricerca, filtri, dettagli e report originale.                                                        |
| Worker            | Avvia/riprende il lavoro, aggiunge note ed evidenze, segnala un blocco motivato e consegna per revisione. Non può assegnare lavoro, approvare la propria consegna o modificare il piano.                                                   |
| Supervisor        | Vede tutte le issue dei progetti supervisionati, comprese quelle senza account responsabile. Coda To assign, assegnazione singola/multipla, riassegnazione e ritorno alla coda.                                                            |
| Supervisor        | Controlla carico del team, priorità, scadenze e disciplina. Approva le consegne oppure le restituisce con istruzioni di correzione. Può riaprire e dichiarare non applicabile con motivazione.                                             |
| Manager           | Ha le funzioni operative del supervisor nei propri progetti, più la vista aggregata del progetto e i feedback del collaudo. Filtri, indicatori ed export CSV seguono il perimetro autorizzato.                                             |
| Admin             | Ha le funzioni manageriali. Crea account con ruolo, azienda e accesso ai progetti; crea progetti e gestisce l’accesso degli utenti già visibili nel workspace. Non può rimuovere l’accesso a un worker con attività aperte da riassegnare. |
| Tutti             | Login, logout, password personale, gestione sessione, indicazione offline, feedback con screenshot e aggiornamento periodico della vista. Le password non vengono restituite dalle API.                                                    |
| Worker / gestione | Avvio e fine turno, rettifica delle ore con motivazione, invio timesheet, approvazione/rifiuto e reinvio. Storico personale e consultazione dello storico dei progetti supervisionati.                                                     |

## Navigazione e interfaccia

Lo stile condiviso usa navigazione laterale scura su desktop, superfici chiare e azioni blu. Su smartphone la barra inferiore dà accesso alle sezioni del ruolo; task, filtri, dettagli e finestre si adattano alla larghezza disponibile.

- Gestione: `/overview` mostra indicatori, distribuzione degli stati, ultimi aggiornamenti e avanzamento per azienda calcolati sui dati autorizzati. `/supervisor` separa le code Unassigned, Assigned, To review, Closed e All activities; team, timesheet e feedback hanno collegamenti diretti.
- Worker: `/dashboard` mostra timbratura e anteprima delle attività aperte; `/my-tasks` offre ricerca e viste per stato; `/time` dedica la schermata al turno. Storico e impostazioni restano sempre raggiungibili.

## Assegnazioni e revisione

- Un worker deve appartenere a tutti i progetti della selezione. Nessuna assegnazione a manager/supervisor o a un account esterno al progetto.
- Le assegnazioni multiple sono atomiche: una versione non aggiornata annulla l’intera operazione. Nessuna sovrascrittura silenziosa.
- Responsabile dell’app e assegnatario del report sono separati. L’azienda dell’issue originale non cambia quando si assegna un worker del team di test.
- Riassegnare un’attività attiva già attribuita a un altro worker la riporta a To do. Rimuovere l’assegnazione da una consegna/in-progress la riporta alla coda. Lo storico completato conserva il suo stato.
- Worker: To do → In progress → Awaiting review. Nota di almeno 10 caratteri oppure evidenza prima della consegna.
- Supervisor/manager: review → Completed oppure In progress con istruzioni di almeno 10 caratteri. Il worker corregge e riconsegna.
- Chi completa approva la consegna; storico, autore, note e versioni sono salvati nel database.

## Collaudo

- Test unitari e PostgreSQL: permessi, transizioni, consegne prive di evidenze, validazione, versioni concorrenti e atomicità delle assegnazioni multiple.
- Test API su server demo isolato: login, accessi negati, assegnazione/riassegnazione, consegna/correzione/approvazione, piano attività, evidenze, timesheet, feedback e logout.
- Neon: assegnazioni persistenti (12 issue al primo worker e 6 al secondo), verifica dell’isolamento fra worker, visibilità di tutte le 305 issue per supervisor, blocco della rimozione di accesso con lavoro aperto.
- Browser: viste worker per stato, layout smartphone e dashboard di gestione. Build di produzione, TypeScript e lint.

## Confini attuali

Il prodotto è una web app responsive con manifest standalone. Non è un’app nativa e richiede rete per salvare. Rimangono esterni a questa consegna: OAuth e sincronizzazione Autodesk/terza piattaforma, push/email/reminder, recupero password via email, SSO/MFA, caricamenti offline, object storage, interfaccia di importazione Excel (lo script già disponibile importa con anteprima e deduplica), modifica del ruolo/disattivazione globale di account e formato di report finale concordato con Tony. Le integrazioni non vengono presentate come funzionanti. Il deploy Vercel resta a cura dell’utente come richiesto.
