// DESTRUCTIVE SCHEMA CLEANUP. Run only after backup and after deleting non-concept nodes.
// Drops an existing legacy constraint if present: ketone_reading_id_unique
DROP CONSTRAINT ketone_reading_id_unique IF EXISTS;
