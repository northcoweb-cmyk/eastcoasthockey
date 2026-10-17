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

The site does not sell shop gear online, only team-store items. Orders are saved in the Blob store (`orders/`) and
shown under **Orders** in the admin. With online payments connected (below) families pay at a secure hosted checkout
and the order is marked **Paid** automatically. Without it, the cart sends an order *request* and the shop collects payment.

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

## Online payments (team orders + gift cards)

Payments go through one small adapter, `api/_pay.js`. **Stripe** (hosted Checkout) is built in; card details never touch
this site. To switch it on:

1. Create a Stripe account. Copy the **secret key** (`sk_live_...`).
2. In Stripe → Developers → Webhooks add the endpoint `https://eastcoasthockeyandskating.com/api/webhook` and select the events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`. Copy the **signing secret** (`whsec_...`).
3. In Vercel add: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and (recommended) `SITE_URL=https://eastcoasthockeyandskating.com`. Redeploy.
4. Test with Stripe test keys (`sk_test_...`, card `4242 4242 4242 4242`) before going live.

When keys are present the site automatically turns on: "Continue to payment" in the team cart, and the **Gift cards** section.
Remove the keys and it falls back to order requests. A different processor (Square, PayPal, Clover...) only needs one more
provider object in `api/_pay.js` (`createCheckout` + `parseWebhook`) and `PAYMENT_PROVIDER=<name>`; orders and gift cards do not change.

How an order flows: order saved as *Awaiting payment* -> customer pays on the hosted page -> the processor calls
`/api/webhook` -> order becomes *Paid* and the receipt and shop alert are emailed. Abandoned checkouts expire after about 30 minutes and are cancelled automatically.
Refunds are issued in the processor's dashboard, then set the order to *Refunded* in Admin → Orders.

## Gift cards

- **Online:** buyer picks an amount ($10 to $500), pays, and the recipient gets an email with the code and a scannable barcode. Nothing is emailed until payment is confirmed.
- **In the shop:** Admin → **Gift cards** lets staff scan or type a code, see the balance, and take an amount off when they ring the sale. They can also sell and email a new card on the spot.
- **Online team store:** customers can enter a code in the cart; the amount is set aside immediately and given back if checkout is abandoned.
- Codes are 12 random characters (no 0/O/1/I), shown as `XXXX-XXXX-XXXX`, barcode is Code 128. Export all cards from Admin → Gift cards → CSV.

If the shop already has a register that sells its own gift cards, these are a separate system: staff redeem them in the admin and ring the
amount up in the register as an "other" tender. Ask the register vendor if it can import a list of custom card numbers.
