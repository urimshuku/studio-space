-- Pending Ko-fi checkouts, keyed by order_id so the webhook can record the donation.
CREATE TABLE IF NOT EXISTS pending_kofi_donations (
  order_id text PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  donor_name text NOT NULL,
  email text NOT NULL,
  amount numeric NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  words_of_support text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pending_kofi_donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON pending_kofi_donations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pending_kofi_email_category_lower
  ON pending_kofi_donations ((lower(email)), category_id);

COMMENT ON TABLE pending_kofi_donations IS
  'Temporary store for Ko-fi: donation details to insert when the Ko-fi webhook confirms payment.';

ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS kofi_transaction_id text;

COMMENT ON COLUMN donations.kofi_transaction_id IS
  'Ko-fi kofi_transaction_id when the donation was confirmed via webhook. Null for Paysera and manual gifts.';

CREATE UNIQUE INDEX IF NOT EXISTS donations_kofi_transaction_id_key
  ON donations (kofi_transaction_id)
  WHERE kofi_transaction_id IS NOT NULL;
