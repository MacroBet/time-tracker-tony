# Rilascio autorizzato e correzioni sicurezza — 5 novembre 2026

Job `tony-secure-release-20261105`, richiesta
`tony-secure-release-request-20261105`, owner Tony. Mandato umano verificato
direttamente nella regia `01a1493a-ee0b-7d62-a861-d8d546bf013c`, messaggio
`01a1ab8a-c773-7840-a28b-b5cc5e24b4cb`: correggere le vulnerabilità e pubblicare
il lavoro completato per il collaudo di Tony. Questo mandato è distinto dal
monitor ristretto; nessun nuovo messaggio cliente, DB remoto o provider live.

## Base e contenuto

Fetch riuscito; main locale `2a34e4051e533ae974f5f47c060ce5f5ac796a1b`,
19 commit avanti e zero indietro rispetto a origin/main
`58b3bb4d047d574144294d783e9c5097ce85f4f3`. Nessun pull necessario.
Inclusi catalogo documenti manuale, correzioni Copilot già concluse, editor Gantt,
scala Days e navigazione equipment, XLSX asset/template vuoto e Overview.
Le consegne precedenti conservano le loro prove locali; nessuna nuova funzione
di dominio introdotta durante la correzione di sicurezza.

Target verificato: `MacroBet/time-tracker-tony`, main, integrazione Vercel esistente
`macrobets-projects/time-tracker-tony`, alias
[time-tracker-tony.vercel.app](https://time-tracker-tony.vercel.app).
Diff nullo per migrazioni, schema DB e script migrate rispetto a origin/main.
Nessuna migrazione o scrittura remota necessaria/eseguita da questo lotto.

## Dipendenze

Aggiornamento manuale mantenendo le major e senza `audit fix --force`:

| Pacchetto                      | Prima          | Lock risolto    |
| ------------------------------ | -------------- | --------------- |
| Next / eslint-config-next      | 16.3.5         | 16.4.5          |
| sharp                          | 0.35.4         | 0.35.5          |
| source-map-js                  | 1.2.1          | 1.2.2           |
| Zod                            | 4.6.2          | 4.6.7           |
| brace-expansion, soltanto lint | 1.1.18 / 5.0.9 | 1.1.21 / 5.0.12 |

Floor dichiarati Next/eslint-config `^16.4.1`, Zod `^4.6.6`; il registro npm
risolve le patch compatibili sopra. sharp/source-map-js/brace-expansion restano
transitive, nessuna nuova dipendenza diretta o override. Aggiornati anche i
binari opzionali Next/sharp e semver transitivo di sharp. Installazione senza
script; guide Next distribuite lette prima e dopo l’aggiornamento.

Fonti: [Next](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr),
[sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w),
[source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q),
[Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
[brace-expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr).

Audit produzione finale: **zero vulnerabilità**, rispetto a 1 critical e 3 high
precedenti. Audit completo: **8 moderate, zero high/critical**, tutte nella
catena dev `typescript-eslint → minimatch 10.2.6`.
[Advisory minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249):
patch 11.0.1 fuori dal range corrente `^10.2.2` di typescript-estree 8.70.0.
Npm propone un downgrade major di eslint-config-next15: non eseguito.
Il residuo è esplicito; nessuna attestazione di audit completo pari a zero.

Commit sicurezza **7341157d239530c433c9b772d076d2fbd44c1753**. Review indipendente del lock superata:45 record
aggiornati, nessun pacchetto aggiunto/rimosso o modifica estranea.

## Prove locali e tutela dei dati

- Typecheck, lint e build Next16.4.5 superati, Node24.19.0.
- **132 test unitari/PostgreSQL locale** superati, inclusi XLSX, Gantt,
  autorizzazioni, validazione Zod e provider simulato.
- **10 test API** superati sulla build locale, porta3107, demo sintetica.
  Primo tentativo senza accesso localhost fermato da sandbox EPERM; medesima suite
  rieseguita con accesso locale consentito. Nessun test contro produzione.
- Variabili DB e provider esplicitamente vuote; DEMO_MODE=true,
  COPILOT_ENABLED=false. Server locale arrestato alla fine dei test.
- `next-env.d.ts` ripristinato byte per byte allo stato preesistente, escluso
  dai commit. Nessun reset, stash, force, import reale, segreto o allegato privato.
- Quattro delta documentali preesistenti revisionati indipendentemente:
  ricevute/hash coerenti, nessun nuovo testo privato. Corretti i riferimenti
  obsoleti alla bozza18ott e al consenso20ott; gli eventi restano storici.

## Pubblicazione

Push normale riuscito da58b3bb4 a **90dd1993f72f0501340dcdd6f786c3d6c6805ce1**,
21 commit, con corrispondenza main remoto verificata anche via GitHub API.
**Vercel Production success**5nov **12:02:58UTC / 13:02:58 Europe/Rome**:
GitHub deployment **7573042780**, Vercel **Ce3ytFZwWSW5aJkNd4cWW1e5Vr7p**.
[Dashboard deploy](https://vercel.com/macrobets-projects/time-tracker-tony/Ce3ytFZwWSW5aJkNd4cWW1e5Vr7p),
[URL deploy](https://time-tracker-tony-a928fzlic-macrobets-projects.vercel.app),
[alias pubblico](https://time-tracker-tony.vercel.app).

Smoke pubblico di sola lettura: HTTP200 per /, /commissioning, /overview e /schedule;
sessione anonima in modalità **neon**, /api/bootstrap **401**. Il bundle Gantt
referenziato dal server risponde200 e contiene scala Days predefinita e editor.
Percorso effettivo `/_next/static/chunks/app/(workspace)/schedule/page-eb5ef812874b2dca.js`,
SHA256 `da264c9e7365ba00142a0103438a995f3bd56c423ff94675c09c9160b1bd6e2a`.
Gli hash dei chunk Vercel differiscono dalla build locale: i primi percorsi locali
sondati davano404; la prova usa quello effettivamente pubblicato.

Non effettuato un collaudo autenticato in produzione, né import/salvataggi reali:
XLSX e Overview sono coperti dai test locali e dal commit pubblicato verificato.
Nessuna credenziale cercata o creata. Ricevute API/audit/smoke in
`output/tony/secure-release-20261105/`, ignorate da Git. Quota conto65→66%, globale,
uso ordinario consentito; nessun reset/acquisto. Formato completo passato dopo sole
correzioni di impaginazione in3 documenti esistenti. Questo aggiornamento delle prove
è un successivo commit documentale: contenuto applicativo invariato rispetto a90dd199.

L’invio WhatsApp5nov12:40 è già consegnato e il consenso consumato. Nessun nuovo
invio o estensione della copertura Tony durante questo incarico. Regole su sequenze,
checklist/approvatori, video e Health restano decisioni aperte, separate dal rilascio.
