# Ko-fi (Kosovo workaround)

Use Ko-fi when PayPal’s card form does not list Kosovo. Donors fill amount, name, and message on Studio Space, then pay on [ko-fi.com/studiospace](https://ko-fi.com/studiospace) with the PayPal account already connected to Ko-fi.

**Log in to PayPal on Ko-fi** rather than guest card. Guest card uses the same billing-country list. Bank transfer stays on the donation form (Paysera IBAN).

Ko-fi cannot lock the euro amount from this site. The panel asks the donor to pay the same amount.

---

## Ko-fi account

1. Page username is `studiospace`. Override with Edge secret `KOFI_USERNAME` only if that changes.
2. Connect **PayPal** (done).
3. Set the page currency to **EUR**.
4. Open [Ko-fi Manage → API / Webhooks](https://ko-fi.com/manage/webhooks). Copy the **verification token**. Paste the webhook URL below.

---

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `KOFI_VERIFICATION_TOKEN` | Yes | Token from the Ko-fi webhooks page. |
| `KOFI_USERNAME` | No | Defaults to `studiospace`. |

---

## Flow

1. Donor fills the Studio Space form.
2. **Continue on Ko-fi** stores a pending row and opens Ko-fi.
3. Donor pays the same euro amount on Ko-fi (PayPal login).
4. Ko-fi POSTs **kofi-webhook**. We match the pending row by email (and amount when possible) and add the gift to the donors list.

---

## Deploy

```bash
supabase db push
supabase secrets set KOFI_VERIFICATION_TOKEN=your-token-from-kofi
supabase functions deploy kofi-pay-url
supabase functions deploy kofi-webhook --no-verify-jwt
```

Webhook URL:

`https://qqlrhqekqcoivarkzkua.supabase.co/functions/v1/kofi-webhook`
