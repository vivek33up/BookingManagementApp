CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.bookings
ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
  resource_id WITH =,
  during WITH &&
)
WHERE (status IN ('held', 'confirmed'));

SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'public.bookings'::regclass
  AND conname = 'no_overlapping_bookings';