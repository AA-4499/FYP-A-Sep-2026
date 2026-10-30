// DESTRUCTIVE SCHEMA CLEANUP. Run only after backup and after deleting non-concept nodes.
// Drops an existing legacy constraint if present: meal_event_id_unique
DROP CONSTRAINT meal_event_id_unique IF EXISTS;
