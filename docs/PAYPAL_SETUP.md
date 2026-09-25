# PayPal donation checkout

**Pay with PayPal or Card** uses PayPal Checkout on the donation form. Amount, name, email, and words of support are taken from Studio Space. PayPal only collects payment (PayPal account or card, when PayPal offers card).

Bank transfer still uses the Paysera IBAN section.

---

## PayPal app (required)

Create a REST app on the PayPal Business account that should receive the donations:

1. Open [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/live).
2. Create a **Live** app (or Sandbox for testing).
3. Copy **Client ID** and **Secret**.

Then:

```bash
npx supabase db push
npx supabase secrets set PAYPAL_CLIENT_ID=your-client-id
npx supabase secrets set PAYPAL_CLIENT_SECRET=your-secret
npx supabase secrets set PAYPAL_MODE=live
npx supabase functions deploy paypal-config paypal-create-order paypal-capture-order
```

For sandbox testing, use sandbox credentials and `PAYPAL_MODE=sandbox`.

The frontend loads the Client ID from **paypal-config**. You do not need a `VITE_PAYPAL_*` GitHub secret.

---

## Flow

1. Donor fills amount, name, email, optional message on the site.
2. **Pay with PayPal or Card** opens a panel. The gold button is PayPal. If PayPal allows on-site card fields, donors enter name, number, expiry, and CVC only. Otherwise PayPal’s own card button is shown.
3. PayPal wallet opens a PayPal window. On-site card stays on this site.
4. **paypal-create-order** stores a pending donation and creates a PayPal order for that euro amount.
5. After payment, **paypal-capture-order** records the donation. The donor is sent to the thank-you page.

---

## Card

On-site card fields (no billing address) only appear if PayPal marks this account eligible for advanced cards. The new app settings page no longer has a separate Advanced Card checkbox; **JavaScript SDK v6** is the related switch.

If on-site fields are not eligible, the black **Debit or Credit Card** button is shown instead. That form still uses PayPal’s country list, which does not include Kosovo. Kosovo donors should use PayPal or bank transfer.
