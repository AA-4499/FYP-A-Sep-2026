// DESTRUCTIVE SCHEMA CLEANUP. Run only after backup and after deleting non-concept nodes.
// Drops an existing legacy constraint if present: patient_id_unique
DROP CONSTRAINT patient_id_unique IF EXISTS;
