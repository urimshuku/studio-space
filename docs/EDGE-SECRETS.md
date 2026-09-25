# Edge Functions — secrets runbook

Secrets for Supabase Edge Functions are **not** committed to git. Set them in the [Supabase Dashboard](https://supabase.com/dashboard) → **Project Settings** → **Edge Functions** → **Secrets**, or via CLI:

```bash
supabase secrets set KEY=value
supabase secrets list   # names only; values are hashed
```

## Required / common

| Secret | Used for |
|--------|-----------|
| `SUPABASE_URL` | Usually injected automatically |
| `SUPABASE_SERVICE_ROLE_KEY` | DB access from functions |
| `RESEND_API_KEY` | Sending email + Resend Contacts |
| `BOOKING_ADMIN_EMAIL` | Booking / join notifications |
| `BOOKING_FROM_EMAIL` | Optional “From” address |
| `PAYSERA_*` | Bank-transfer donation checkout (if used) |
| `PAYPAL_CLIENT_ID` | PayPal Checkout (public client id) |
| `PAYPAL_CLIENT_SECRET` | PayPal Checkout (server only) |
| `PAYPAL_MODE` | `live` (default) or `sandbox` |

## `PUBLIC_APP_URL` (email footers)

- **Set on the server** as an Edge secret — **not** a `VITE_*` variable in the React app.
- Value: the **public origin** of the deployed site, **no trailing slash**, e.g. `https://www.studiospace.community`
- Used to build **unsubscribe** and **email preferences** links inside transactional emails.
- **If those links are missing** in outgoing mail, verify `PUBLIC_APP_URL` is set and redeploy functions that send email / render footers.

The frontend only needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see root `.env.example`).

## After changing secrets

Redeploy affected functions so new invocations pick up env (or rely on platform refresh; redeploy is the safe default):

```bash
supabase functions deploy book-venue join-activity paysera-pay-url paysera-callback paypal-config paypal-create-order paypal-capture-order unsubscribe-user email-preferences approve-booking track-open track-click newsletter-signup
```
