# P6 Gantt — parità visiva,6nov2026

Mandato incrementale dello stesso job `tony-test-ready-delivery-20261105`.
Marco confronta lo screenshot10:28 con il Gantt locale approvato. Il precedente
PASS verificava scala e presenza dati, ma non accettava la parità visiva: assenza
colonne, righello perso e layering sopra la shell restavano difetti concreti.
Nessun altro import, sviluppo backend, modifica fonti o browser umano.

## Correzione

Il righello `GanttRuler` è condiviso con il Gantt normale di ScheduleWorkspace.
Il P6 replica la stessa struttura tabellare: Activity, azione calendario, Hours,
Start, Finish, poi timeline; nome in primo piano e ID secondario, righe48px.
Hours resta la durata P6 sorgente: nessuna conversione8h/giorno. Barre chiare,
bordate ed etichettate come nel Gantt normale; milestone distinte. Unico viewport
interno per righe/colonne/date con thead sticky e stacking isolato sotto la shell.
Su mobile nomi ancorati e scorrimento orizzontale per le altre colonne.

Days e frecce reali predefiniti; Months resta una scelta esplicita. Finestra iniziale
sul cluster di date di inizio più frequente della pagina (parità: più antica), con
2giorni di margine, non sui3lunghi approvvigionamenti di marzo. Sul file completo
apre19settembre. Ordine sorgente e date non cambiano. Le attività fuori finestra
hanno azione calendario per raggiungerle. Conteggio dinamico delle attività nella
porzione di date realmente visibile, non nell’intera striscia35giorni. Legami
fuori pagina esplicitati, nessuna freccia inventata e nessun completamento dedotto.

## Confronto e prove proporzionate

Batch privato `output/playwright/p6-parity-20261106/`:8catture full viewport,
normal/P6 × desktop1440/mobile390 × inizio/metà. Il reviewer regia ha guardato le
coppie desktop e confermato struttura, cluster utile e righello/layering; prima
cattura marzo scartata nello stesso batch. La regia ha poi guardato normal-mobile-full, p6-mobile-full e p6-mobile-mid:
conferma desktop/mobile accolta, nessun rilievo bloccante; stop polishing. Non si deduce accettazione da soli unit test.

Geometria browser: righe48px, scostamento righe↔barre0px; righello invariato
(top234,5px desktop/375px mobile) a metà scroll verticale e con scroll orizzontale;
point-test shell in primo piano.26frecce reali nella finestra verificata. Modalità
dettaglio mantiene scroll; riapertura Days; JSON della pagina sorgente prima/dopo
identico, nessun pageerror. P6 completo16969/36923 conservato nella demo isolata.
5unitari mirati asse/ancora/barre passati, poi2rilevanti ripetuti dopo la correzione
cluster; typecheck/lint/build verdi. Detector: un warning euristico sul pulsante
calendario, verificato come falso positivo: stato normale slate600suwhite, hover
blue700su blue50. Nessun ulteriore ciclo di polishing o suite generale.

Backend lossless/caching precedente intatto, nessuna nuova misura latenza online.
Screenshot/fonti private esclusi da Git; next-env.d.ts preesistente preservato.
Pubblicazione e accettazione online vanno distinte dal confronto locale.

## Rilascio verificato

Applicazione **058d69805410ebb45819954abc59872d5ddb40a1**, push normale su main,
Vercel Production **success7597912343**,6nov10:29:36UTC (11:29:36Europe/Rome).
Confronto visivo desktop/mobile accolto dalla regia; resta il singolo CUA finale
a scorrimento in produzione a cura della regia. Non dichiarato già eseguito.
Ricevuta privata `output/playwright/p6-parity-20261106/deploy.private.json`.
Backend/cache e dati cliente invariati. Nessun import o invio; next-env preservato.
