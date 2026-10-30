# Aura migration checklist — do not skip

- [ ] Confirmed Aura database/instance is the intended KG and not another team's Neo4j service.
- [ ] Ran each file in `cypher/audit/` separately and saved the outputs privately.
- [ ] Reviewed node labels, relationship types, concept names, all current sourceRefs and the Type 1 query results.
- [ ] `05_duplicate_concept_names.cypher` returned zero rows. If not, stopped and planned consolidation.
- [ ] Backed up the existing mixed graph privately. It contains health-related patient examples; do not commit the backup to GitHub.
- [ ] Reconciled any important existing edge or concept that should survive into the target allowlist.
- [ ] Received explicit review approval to replace the current mixed graph with the Type 2-only concept graph.
- [ ] Ran `01_delete_existing_relationships.cypher`, then `02_delete_non_concept_nodes.cypher`, individually and in that order.
- [ ] Ran each file under `migration/05_drop_legacy_constraints/` individually to remove obsolete patient/reading/event constraints; retain the existing `concept_name_unique` constraint.
- [ ] Ran `03_remove_unapproved_concepts.cypher`.
- [ ] Ran `04_create_or_confirm_concept_name_constraint.cypher`.
- [ ] Ran `seed/01_upsert_concepts.cypher` and each file under `seed/relationships/` separately; the concept count is 37 and relationship processed counts sum to 42.
- [ ] Ran each file in `cypher/verify/`; Type 1 and persistent patient/event checks return zero rows; all relationship evidence checks return zero rows.
- [ ] Reviewed each candidate relationship against the full cited source and project scope, including any publisher-terms check noted in `EVIDENCE_REVIEW_NOTES.md`; changed only accepted edges from `candidate_for_review` to `reviewed` (no bulk approval).
- [ ] Confirmed the AI query only retrieves edges marked `reviewed`; candidate edges are excluded.
- [ ] Exported the approved graph rows privately for offline AI evaluation and saved schema version/export date.
- [ ] Only after this passes, begin the backend read-only Aura adapter and doctor-only API integration.

**No cleanup, seed, relationship-review, AI-read, or verification query in this pack has been executed in Neo4j Aura.** The read-only audit outputs supplied on 2026-10-23 are summarized in `AUDIT_RECONCILIATION.md`. The deletion scripts are destructive. Duplicate audit, private backup, and approval of the target relationship changes are mandatory.
