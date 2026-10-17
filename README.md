# East Coast Hockey & Skating Supply

Static site (`index.html`, no build step) on Vercel, plus a small admin portal.

- `index.html` – the public site
- `assets/` – images, videos, team logos, hero animation script
- `admin/index.html` – admin portal at `/admin`
- `api/` – Vercel serverless functions used by the portal (`content`, `login`, `logout`, `me`, `upload`)
- `api/defaults.json` – the original content; the site falls back to it when nothing has been saved
- `dev-server.js` – local preview (`node dev-server.js 3000`)

## Admin portal

Sign in at `/admin`. Easy edits only (plus a list of team order requests under the Orders tab): announcement bar, homepage headline, contact email, location
addresses and phones, shop category cards, and team stores (logo, details, products, show/hide).

**Test login:** `Mike` / `1234`. This is only for testing. Before real use, set these in
Vercel → Project → Settings → Environment Variables and redeploy:

| Variable | Purpose |
| --- | --- |
| `ADMIN_USER` | admin username |
| `ADMIN_PASSWORD` | admin password (use a long one) |
| `ADMIN_SECRET` | random string used to sign sessions |

**Saving edits permanently:** connect a Vercel Blob store (Project → Storage → Blob → Connect). This adds
`BLOB_READ_WRITE_TOKEN` automatically. Private stores are supported (the default). If your store is public, also set
`BLOB_ACCESS=public`. Uploaded images are served through `/api/img` either way. Without it the portal still runs but edits do not persist, and the
portal shows a warning.

## Team orders

The site does not sell gear online. Families send **team-store order requests** from the cart; these are saved in the
Blob store (`orders/`) and shown under **Orders** in the admin. No payment is processed on the site; the shop contacts
the family to confirm and take payment.

## Store setup checklist

Set these in Vercel (Settings → Environment Variables), then redeploy:

| Variable | Purpose |
| --- | --- |
| `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_SECRET` | admin login and session signing |
| `RESEND_API_KEY` | sends order receipts, shop alerts, shipping updates and contact-form forwards (https://resend.com) |
| `MAIL_FROM` | e.g. `East Coast Hockey <orders@eastcoasthockeyandskating.com>` (domain must be verified in Resend) |
| `SHOP_NOTIFY_TO` | comma-separated inboxes for new-order and contact alerts |

Without the email variables the site still works; orders and messages simply appear in the admin only.

Orders are managed under **Admin → Orders** (status, payment, tracking, team production sheets, CSV exports, packing slips).
Payment is not processed by the site yet: the shop confirms each order and collects payment, then marks it paid.
