-- Contributors (by date, newest first): Ardian, Xhevat, Elona, then Anonymous.
-- The three named gifts were inserted with the same created_at.

UPDATE donations
SET created_at = timestamptz '2026-08-25 18:10:58+00'
WHERE donor_name = 'Ardian Batusha'
  AND amount = 800
  AND is_anonymous = false;

UPDATE donations
SET created_at = timestamptz '2026-08-25 18:10:57+00'
WHERE donor_name = 'Xhevat Kastrati'
  AND amount = 100
  AND is_anonymous = false;

UPDATE donations
SET created_at = timestamptz '2026-08-25 18:10:56+00'
WHERE donor_name = 'Elona dhe Edonisi'
  AND amount = 100
  AND is_anonymous = false;
