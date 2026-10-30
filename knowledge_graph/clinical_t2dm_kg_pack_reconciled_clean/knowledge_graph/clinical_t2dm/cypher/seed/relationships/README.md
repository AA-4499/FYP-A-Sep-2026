# Relationship seed order

Each `.cypher` file contains exactly one Cypher statement and uses a static relationship type, so the import does not depend on Neo4j's dynamic relationship-type syntax. Run each file separately in Neo4j Browser, after concept nodes and the name constraint exist.

The files are ordered by relationship type, not execution dependency. Run all 15 files and confirm the sum of `relationshipsProcessed` is 42. All edges are created as `candidate_for_review`; they are deliberately excluded from AI queries until the individual edge's source, direction, scope and publisher-terms status have been reviewed. Do not bulk-mark edges `reviewed`.
