# Migrazione e decisioni

## Cosa è cambiato

Il prototipo non aveva un backend: `mockData.ts` inizializzava e modificava `localStorage`, e l’accesso consisteva nella scelta libera di un utente. React Router trasportava gli ID tramite navigation state, perdendoli al refresh. GPS, NFC, Wi-Fi e sincronizzazione erano simulati.

La nuova app usa route Next.js reali, layout server con sessione verificata, API con validazione e repository Neon. Il browser riceve soltanto i dati autorizzati; non riceve credenziali DB, hash password o payload di tutti gli allegati. I link precedenti `/task-detail?taskId=...` e `/shift-summary?shiftId=...` vengono rediretti ai dettagli nuovi.

Il disegno mantiene card, colori blu/viola e controlli grandi del prototipo. Le attività diventano il punto di ingresso principale. La dashboard espone avanzamento per azienda e disciplina, blocchi, scadenze, attività senza aggiornamenti da sette giorni, filtri e CSV. I contatori e l’export seguono gli stessi filtri. L’avanzamento esclude dal denominatore le attività non applicabili; queste restano distinguibili dalle completate.

Le priorità, i riferimenti esterni, l’area e la disciplina derivano dal contesto e dalle schermate ricevute. I dati demo sono sintetici, non una trascrizione o importazione ufficiale delle issue Autodesk. Il report Excel ricevuto successivamente è descritto in [Analisi importazione](import-analysis.md).

## Autorizzazione

- Ogni account deve appartenere esplicitamente a un progetto tramite `project_memberships`.
- Operatore: solo attività assegnate e turni propri.
- Supervisore: attività e turni dell’azienda nei progetti assegnati.
- Manager/admin: tutte le aziende, ma solo nei progetti assegnati. Non esiste un superutente che attraversa automaticamente tutti i cantieri.
- Creazione attività solo per supervisori/manager, con assegnatario operatore appartenente al progetto e alla vista consentita.
- Ogni API rivalida sessione e perimetro. Cambiare un URL, un ID o il client non estende i permessi.

La scelta degli utenti è disponibile solo nella demo locale. Con Neon, l’accesso usa password individuali scrypt, sessioni opache casuali di 8 ore, hash del token in DB e cookie HttpOnly/SameSite/Secure in produzione. Le richieste mutative controllano Origin/Host. I tentativi di login sono limitati nel DB per account (e per IP dietro Vercel), quindi il limite è condiviso tra istanze. Non sono ancora presenti SSO, MFA, recupero password o interfaccia amministrativa degli utenti.

## Workflow iniziale

- To do → In progress / Blocked / Not applicable.
- In progress → Completed / Blocked / Not applicable.
- Blocked → In progress / Not applicable.
- Completed e Not applicable possono essere riaperti da supervisore/manager.
- Completed richiede una nota nuova di almeno 10 caratteri oppure un’evidenza caricata.
- Blocked e Not applicable richiedono una motivazione nuova di almeno 10 caratteri.
- Stato, autore, data e note sono registrati nello storico. La nota corrente non sostituisce le note storiche.

È una prima regola operativa da validare con Tony: un’eventuale approvazione formale delle chiusure o obbligo universale di fotografia richiederà un passaggio ulteriore. Gli aggiornamenti usano una versione: un client con dati vecchi riceve `409`, anziché sovrascrivere. Aggiornamento attività e audit sono atomici nello stesso statement SQL.

I turni mantengono il flusso esistente: check-in manuale → fine turno → revisione delle ore → invio → approvazione/rifiuto motivato. Il server imposta le ore di inizio/fine; l’indice PostgreSQL impedisce due turni attivi per persona. Nessun GPS/NFC/Wi-Fi viene dichiarato funzionante senza una vera integrazione.

## Evidenze e feedback

Il primo backend salva payload e metadati degli allegati in PostgreSQL. PNG/JPEG/WebP/PDF, massimo 2 MB per file, 20 file per attività con controllo di versione sugli upload; il tipo viene rilevato dalla firma del contenuto. Il download richiede sessione e accesso all’attività e usa `Content-Disposition: attachment`. Nessun file è scritto nel filesystem temporaneo di Vercel.

È una soluzione contenuta per il collaudo, non l’architettura finale per un grande archivio fotografico: passare i payload a object storage privato (es. Vercel Blob/S3) mantenendo metadati e autorizzazioni in Neon, con scansione malware, quote rigorose e politica di conservazione. Le firme file non sostituiscono una scansione antivirus.

“Report an issue” salva descrizione, pagina e screenshot opzionale nella sezione Feedback. Il manager vede i feedback dei suoi progetti. Non viene inviata email a Marco: mancano canale, indirizzo e configurazione di invio. Lo screenshot cattura il contenuto HTML della vista; va verificato prima dell’invio e può non riprodurre contenuti esterni o livelli speciali del browser.

## Limiti e fase successiva

1. **Neon reale:** database di test collegato il 12 settembre 2026, migrazione iniziale applicata e 11 tabelle verificate. Configurazione locale esclusa da Git, modalità demo disattivata. Verificati login in modalità Neon e rifiuto delle API senza sessione. Restano creazione del primo account e collaudo autenticato, poi configurazione e verifica su Vercel.
2. **Import Excel/CSV:** ricevuto e analizzato l’export di 305 issue. Servono assegnazioni ad aziende/ruoli oltre alle persone e conservazione degli stati esterni prima di importarlo correttamente. Lo schema ha già unicità `(project_id, source, external_id)`. L’export CSV della vista è disponibile; l’import non è ancora implementato e nessuna issue del report è stata caricata.
3. **Autodesk/terza piattaforma:** integrare API/OAuth dopo disponibilità di credenziali, permessi e frequenza di sincronizzazione. Il nome “Procure” è ambiguo: `procore` è un valore predisposto nello schema, non una conferma del prodotto da integrare.
4. **Report manageriale:** validare il formato atteso con Tony; al momento sono disponibili dashboard e CSV.
5. **Offline e notifiche:** l’app avvisa quando manca rete e non dichiara riuscito un salvataggio. Non ha coda offline, push o reminder attivi.
6. **Scalabilità:** aggiungere paginazione e filtri server per grandi dataset, object storage, pulizia periodica sessioni/tentativi di login scaduti e telemetria. Il bootstrap carica il perimetro autorizzato del progetto; non è ancora paginato.
7. **Date:** le scadenze sono giorni di calendario del sito, attualmente `Europe/Amsterdam` per AMS16. Portare il fuso sul modello progetto prima di gestire cantieri in più fusi. I timestamp sono memorizzati con timezone e mostrati esplicitamente nel fuso del sito, per evitare differenze tra rendering server e browser.
8. **Dati precedenti:** i dati del vecchio `localStorage` non vengono cancellati né importati automaticamente. Se esistono dati da conservare, esportarli e mapparli prima del passaggio definitivo.

## Riferimenti tecnici

- [Migrazione Vite → Next.js](https://nextjs.org/docs/app/guides/migrating/from-vite)
- [Cookie e sessioni nei Route Handler](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [Drizzle e Neon HTTP](https://orm.drizzle.team/docs/connect-neon)
