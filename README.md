# East Coast Hockey & Skating Supply

Static site (`index.html`, no build step) on Vercel, plus a small admin portal.

- `index.html` – the public site
- `assets/` – images, videos, team logos, hero animation script
- `admin/index.html` – admin portal at `/admin`
- `api/` – Vercel serverless functions used by the portal (`content`, `login`, `logout`, `me`, `upload`)
- `api/defaults.json` – the original content; the site falls back to it when nothing has been saved
- `dev-server.js` – local preview (`node dev-server.js 3000`)

## Admin portal

Sign in at `/admin`. Easy edits only: announcement bar, homepage headline, contact email, location
addresses and phones, shop category cards, and team stores (logo, details, products, show/hide).

**Test login:** `Mike` / `1234`. This is only for testing. Before real use, set these in
Vercel → Project → Settings → Environment Variables and redeploy:

| Variable | Purpose |
| --- | --- |
| `ADMIN_USER` | admin username |
| `ADMIN_PASSWORD` | admin password (use a long one) |
| `ADMIN_SECRET` | random string used to sign sessions |

**Saving edits permanently:** connect a Vercel Blob store (Project → Storage → Blob → Connect). This adds
`BLOB_READ_WRITE_TOKEN` automatically. Without it the portal still runs but edits do not persist, and the
portal shows a warning.
