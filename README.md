# Traffic Authority

Public-facing site for **Traffic Authority** — ITS protocol translation, delivered through a certified 8(a) / SDVOSB / DBE / HUB / NCTRCA prime, nationwide.

Single React component, Vite-built, deployable to Vercel.

## Stack
- React 18 + Vite
- PostHog (optional, auto-enabled when env var is set)
- Supabase REST (Centripetal Command Center, project `ulzyudbqkmjistymlqwg`) for form RPC and opportunities feed

## Run locally
```
npm install
npm run dev
```

## Build
```
npm run build
```

Output goes to `dist/`. Vercel auto-detects Vite and builds with these defaults.

## Environment variables (optional)
Set in Vercel project settings to enable PostHog analytics:
- `VITE_POSTHOG_KEY` — your PostHog project key (starts with `phc_`)
- `VITE_POSTHOG_HOST` — defaults to `https://us.i.posthog.com`

Without these, the site works fine; analytics silently no-op.

## Domain
Production: `traffic-authority.com`

## Supabase wiring
Reads from `v_ta_opportunities_public` view. Writes via `fn_submit_ta_lead` RPC. Both already provisioned. Publishable key is embedded in the component (designed to be public).
