# Knowledge graph resources

This directory contains several separate knowledge-graph prototypes and resources. Do not assume they target the same database:

- `patient_kg/` is the isolated patient-condition graph prototype.
- `seed_graph.py` is a legacy scaffold, not the curated clinical T2D concept-graph seeder.
- `clinical_t2dm_pack_security_review.md` records the sanitization review for the curated Type 2 Diabetes concept-graph package.

The curated package includes concept and relationship catalogues, source references, a relationship evidence matrix, seed queries, read-only audit/verification queries, and migration/AI-use notes. All proposed relationships remain candidates for review.

**Warning:** migration queries may delete graph data or drop constraints. Audit and back up the intended database before executing them. Package contents and historical counts do not establish the current state of the active Aura instance.
