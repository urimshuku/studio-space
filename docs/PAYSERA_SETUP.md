# Paysera donation checkout (bank transfer)

**Paysera** is the bank-transfer path: the donation form shows the Paysera account IBAN. PayPal and card go through PayPal Checkout — see `docs/PAYPAL_SETUP.md`.

Users enter amount, name, and email on the site and can pay with PayPal or card, or transfer to the Paysera IBAN listed on the form. No card or bank details are stored by the app.

---

## Environment variables

### Frontend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (for Edge Functions). |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key. |

### Backend (Supabase Edge Function secrets)

Set these in **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**.

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYSERA_PROJECT_ID` | Yes | Your Paysera project ID (e.g. `254482`). From Paysera: Service management → My Projects → Project settings. |
| `PAYSERA_SIGN_PASSWORD` | Yes | Sign password for the project (Paysera → General settings). Never expose in the frontend. |
| `PAYSERA_TEST` | No | Set to `true` to allow test payments. Enable test mode for the project in Paysera first. |

---

## Flow

1. The donation form shows two Paysera bank options: **Kosovo** (`XK…` IBAN) and **International** (`LT…` IBAN), with recipient, IBAN, and SWIFT/BIC.
2. The donor transfers to the matching IBAN (typically with their name as the payment reference).
3. Studio Space records the gift on the donors list after the transfer arrives.

Hosted Paysera checkout (`paysera-pay-url` / `paysera-callback`) is still in the repo but is not used by the donation form.

---

## Deploy

```bash
supabase db push
supabase functions deploy paysera-pay-url
supabase functions deploy paysera-callback
```

Then set the secrets (see above). The callback URL is your Supabase project URL + `/functions/v1/paysera-callback`; ensure it is reachable by Paysera (no auth required for the callback).

Deploy `paysera-callback` with JWT verification off (`verify_jwt = false` in `supabase/config.toml`, or `supabase functions deploy paysera-callback --no-verify-jwt`), because Paysera’s server callback does not send a Supabase JWT.

---

## Fix error 0x13 (URL address mismatch)

Paysera error **0x13** means `accepturl`, `cancelurl`, `callbackurl`, or the payment referer does not match domains confirmed on the project. **Every domain must be ownership-verified (meta tag / file); Paysera will not whitelist third-party hosts like `*.supabase.co`** (confirmed by Paysera tech support, project 256874).

Because GitHub Pages is static and cannot receive server callbacks, the callback goes through a small proxy on a subdomain we own — see `paysera-proxy/README.md`.

Domains to confirm in Paysera → **Projects and Activities → My projects → Project settings**:

| Purpose | Domain / URL to confirm |
|---------|-------------------------|
| Live site (accept/cancel + referer) | `https://www.studiospace.community` |
| Callback proxy | `https://payments.studiospace.community` |

Exact URLs this app sends:

- `accepturl`: `https://www.studiospace.community/success?paysera=1`
- `cancelurl`: `https://www.studiospace.community/cancel`
- `callbackurl`: `https://payments.studiospace.community/paysera-callback` (set via Edge secret `PAYSERA_CALLBACK_URL`; falls back to the Supabase URL if unset, which Paysera rejects)

Also enable **Allow test payments** in the project, and set Edge secret `PAYSERA_TEST=true` while Paysera reviews. After go-live, set `PAYSERA_TEST=false`.

Do **not** use Paysera’s donation-button HTML generator for this site; the form shows the Paysera IBAN in a bank-transfer section.

---

## Callback verification

The **paysera-callback** function:

- Receives GET with query params `data` (base64-encoded payload) and `ss1` (signature).
- Verifies `ss1 === MD5(data + PAYSERA_SIGN_PASSWORD)` before trusting the payload.
- Only on `status=1` (success): loads pending donation by `orderid`, inserts into **donations**, updates category total, deletes pending row, returns `OK`.
- Stores only non-sensitive data (amount, donor name, email, reference). No card or bank details.

---

## GitHub Pages / CI

For the live site, add repository secrets so the build gets Supabase config:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The workflow should pass these into the build (see your workflow file).
