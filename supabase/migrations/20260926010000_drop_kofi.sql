DROP TABLE IF EXISTS pending_kofi_donations;

ALTER TABLE donations
  DROP COLUMN IF EXISTS kofi_transaction_id;
