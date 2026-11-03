// DESTRUCTIVE SCHEMA CLEANUP. Run only after backup and after deleting non-concept nodes.
// Drops an existing legacy constraint if present: cgm_reading_id_unique
DROP CONSTRAINT cgm_reading_id_unique IF EXISTS;
