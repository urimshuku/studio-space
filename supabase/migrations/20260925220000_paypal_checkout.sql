-- Email on pending PayPal donations, plus unique PayPal order id on confirmed donations.
ALTER TABLE pending_paypal_donations
  ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN pending_paypal_donations.email IS 'Donor email saved before PayPal capture.';

CREATE INDEX IF NOT EXISTS idx_pending_paypal_email_category_lower
  ON pending_paypal_donations ((lower(email)), category_id);

ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS paypal_order_id text;

COMMENT ON COLUMN donations.paypal_order_id IS 'PayPal order id when the donation was captured via PayPal Checkout.';

CREATE UNIQUE INDEX IF NOT EXISTS donations_paypal_order_id_key
  ON donations (paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;
