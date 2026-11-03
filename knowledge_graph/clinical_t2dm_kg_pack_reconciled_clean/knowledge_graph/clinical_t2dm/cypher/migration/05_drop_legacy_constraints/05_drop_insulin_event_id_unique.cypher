// DESTRUCTIVE SCHEMA CLEANUP. Run only after backup and after deleting non-concept nodes.
// Drops an existing legacy constraint if present: insulin_event_id_unique
DROP CONSTRAINT insulin_event_id_unique IF EXISTS;
