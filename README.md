# app-quadra-ui

Interfaccia web di **Quadra**, app di finanza personale e condivisa a partita doppia. React + TypeScript + Vite, servita da nginx non root.
Backend: [app-quadra](https://github.com/mellera/app-quadra). Design system "Wallet Ledger" (monospace, angoli netti, tema chiaro/scuro).

## Sviluppo

```bash
npm ci
cp .env.example .env      # VITE_API_URL
npm run dev
npm test && npm run lint && npm run build
```

## Sicurezza

- Login OIDC Authorization Code + PKCE (oidc-client-ts); il token resta **solo in memoria**, mai in localStorage. In sessionStorage c'è solo lo stato PKCE.
- La configurazione di accesso è letta a runtime da `/auth-config.json` (nessun segreto: solo issuer e client id pubblico).
- Nessun `dangerouslySetInnerHTML`; CSP restrittiva, `frame-ancestors 'none'` e altri header in `nginx.conf`.
- Redirect post-login solo su percorsi interni (`safeReturn`).
- Container non root (UID 101), filesystem di sola lettura, porta 8080, `/healthz`.

## Infrastruttura (infra-apps)

`values.yaml` (componente `ui`):

```yaml
ui:
  enabled: true
  image: ghcr.io/mellera/app-quadra-ui
  host: quadra.roger08.cloud
```

Passi manuali, una tantum:

```bash
scripts/new-app.sh --go quadra
scripts/new-client.sh quadra --mcp --callback /auth/callback
```

`--callback /auth/callback` registra il redirect usato dalla UI. Aggiungere il segreto `INFRA_APPS_DEPLOY_KEY` alla repo e fare il merge su `main` solo dopo la registrazione dell'app: ogni push su `main` è un deploy.
L'URL dell'API (`VITE_API_URL=https://quadra-api.roger08.cloud`) è un build-arg fissato nel workflow.

## Schermate

Home, Movimenti (con dettaglio, modifica e storno), Conti, dettaglio conto, Riconciliazione (solo desktop), Budget, Report (solo desktop), Libro e membri, Account/tema. Sotto i 900 px: tab bar mobile.

## Non ancora fatto

Movimenti previsti e ricorrenze, importazione estratti conto, report di confronto.

## PWA (installazione)

L'app è installabile: `vite-plugin-pwa` genera `manifest.webmanifest` (standalone, icone 192/512 e maskable in `public/`) e il service worker `sw.js`. Chrome propone «Installa app» (anche da **Account › App**) e l'icona si apre a schermo intero.

- Il service worker precachea solo la shell e gli asset con hash; **API e `/auth-config.json` passano sempre dalla rete** (l'app funziona solo online).
- Aggiornamenti: alla nuova versione compare il banner «Nuova versione disponibile · Aggiorna».
- nginx serve `sw.js` e il manifest con `no-cache`.
- Il service worker è attivo solo nella build di produzione; per provarlo: `npm run build && npm run preview`.
