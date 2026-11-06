# Clinical T2D knowledge-graph package — security review

Review date: 2026-10-29

## Disposition

The supplied `clinical_t2dm_kg_pack_reconciled.zip` was inspected and a sanitized archive was generated. Two explicit longitudinal patient-record IDs in the package README were removed. They were replaced with a description of the prior prototype's node/event types without patient identifiers.

Cleaned handoff artifacts:
- ZIP: `clinical_t2dm_kg_pack_reconciled_clean.zip`
- TAR.GZ: `clinical_t2dm_kg_pack_reconciled_clean.tar.gz`

SHA-256:
- ZIP: `d8c85509a130e1e915e090ae0e13e77c1d66f2b0dd8d8c5e18bee53ef49aa4fc`
- TAR.GZ: `fe3ed7fc832001f481415487469152e3200b2652d800d1c2b32bfded0fc5bf2d`

## Checks performed

A pattern-based scan of the extracted package was performed for:
- common API keys, access tokens, JWT-like tokens and private-key PEM headers;
- password/secret environment assignments;
- email addresses;
- local Windows user/project paths and private network endpoints;
- known Aura instance identifiers and example longitudinal patient IDs.

After the README remediation, the scan found no matches for credentials, keys, email addresses, local machine paths, private-network endpoints, or patient-record identifier patterns.

This is a targeted pattern scan, not a formal guarantee that all possible secrets or sensitive content have been detected. The clinical evidence package contains medical-concept vocabulary, literature/reference metadata, evidence notes, Cypher scripts and a relationship evidence matrix; it is not intended to contain patient-level clinical exports.

## Scientific and operational boundaries

- The evidence matrix contains 42 proposed relationships involving 37 distinct concept names and 15 relationship types.
- All 42 proposed relationships remain `candidate_for_review`; none is marked reviewed. Do not bulk-approve them.
- The bibliography contains 29 reference entries. Distinct numeric reference labels in the relationship matrix should be reconciled to the bibliography and checked against the cited source before a relationship is approved.
- The package includes migration queries that delete relationships/nodes and drop constraints. Do not run them against Aura without a fresh read-only audit, a verified private backup, duplicate checks and explicit approval.
- Historical counts from an earlier Aura instance do not prove the contents of the replacement instance.

## Add the cleaned source files to this branch

The archive itself is not embedded in this documentation commit. The recommended repository layout is to commit the **extracted source directory** `knowledge_graph/clinical_t2dm/` so that the catalogue, bibliography, CSV evidence matrix, Cypher and notes can be reviewed directly on GitHub. The ZIP can remain a local/download artifact to avoid storing a duplicate compressed copy in the repository.

After downloading the cleaned ZIP, verify its SHA-256 using `Get-FileHash -Algorithm SHA256`. Extract it at the repository root (the archive paths begin with `knowledge_graph/clinical_t2dm/`). If that directory already exists, inspect and reconcile it before extraction rather than overwriting it blindly. Then stage and commit `knowledge_graph/clinical_t2dm/` on the `KnowledgeGraph` branch.

Review the package README and migration checklist before executing any Cypher.
