/*
  Add €1,000 to Renovations from three named donors:
  - Elona dhe Edonisi €100
  - Xhevat Kastrati €100
  - Ardian Batusha €800

  All three are dated 1 month ago.
*/

INSERT INTO donations (category_id, donor_name, amount, is_anonymous, created_at)
SELECT id, 'Elona dhe Edonisi', 100, false, now() - interval '1 month'
FROM categories
WHERE name = 'Renovations'
LIMIT 1;

INSERT INTO donations (category_id, donor_name, amount, is_anonymous, created_at)
SELECT id, 'Xhevat Kastrati', 100, false, now() - interval '1 month'
FROM categories
WHERE name = 'Renovations'
LIMIT 1;

INSERT INTO donations (category_id, donor_name, amount, is_anonymous, created_at)
SELECT id, 'Ardian Batusha', 800, false, now() - interval '1 month'
FROM categories
WHERE name = 'Renovations'
LIMIT 1;

UPDATE categories
SET current_amount = COALESCE(current_amount, 0) + 1000,
    updated_at = now()
WHERE name = 'Renovations';
