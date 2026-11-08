# Proposed Knowledge Graph change permissions

**Status:** Design proposal for group review. No permission changes or graph writes are performed by this document.

## Recommendation

Do not make the system Admin the mandatory clinical approver for every knowledge-graph change. A platform Admin is responsible for accounts, roles, access and operational administration; that role does not automatically mean the person is qualified to approve medical meaning.

Instead, separate **permission administration**, **clinical review** and **publication**. An Admin can grant a Doctor the additional `kg_reviewer` or `kg_curator` permission after the project agrees on the role. A Doctor who has only ordinary Doctor access may still prepare and submit changes.

## Suggested permission tiers

| Change type | Suggested workflow |
|---|---|
| Typo, formatting or display-only correction that does not alter clinical meaning | Doctor may correct directly, provided every revision is logged and can be reverted. |
| Add an alias/synonym or non-clinical display metadata | Doctor may save a versioned proposal; a reviewer can approve routinely or batch-review it. |
| Add a new concept or relationship | Draft proposal, source mapping and review by a Doctor with clinical KG reviewer permission. |
| Change an existing relationship's direction, predicate, evidence note, source references or evidence status | Explicit clinical review before publication. |
| Rename, merge, retire or delete a core concept; alter core relationships, schema, clinical thresholds or treatment rules | Higher-risk proposal requiring a second authorised reviewer and a curator-controlled release. |
| Publish a new KG release, restore a prior release or perform destructive Aura maintenance | Curator/publisher permission, verified backup, audit record and rollback plan. |
| Grant/revoke roles or reviewer/curator permissions | Platform Admin only. |

## Why "non-destructive" is not enough by itself

A change can leave every node and relationship in place and still change the clinical meaning. For example, changing `ASSOCIATED_WITH` to a causal-sounding predicate, reversing an edge, changing an evidence source, or marking a candidate relationship as reviewed can affect what the AI retrieves. These should be classified by clinical impact and provenance, not only by whether the operation deletes data.

For genuinely low-risk edits, direct Doctor editing is reasonable only if the system keeps the previous value, editor identity, timestamp, change reason and a one-click rollback. A description edit should not be classified as display-only if it changes the clinical interpretation.

## Separation of responsibilities

- **Doctor:** view the graph and submit changes; may receive additional review permissions.
- **Clinical KG reviewer:** checks source accuracy, scope, wording, direction and evidence quality.
- **KG curator:** prepares/publishes a versioned release after review and backup.
- **Platform Admin:** manages identities and grants/revokes the reviewer/curator permissions; may also hold a clinical role if separately qualified and authorised.

One person may hold more than one role in a small student project, but the permission checks should remain distinct. An Admin should not be assumed to be a clinical reviewer merely because they are an Admin.

## Implementation notes for the next phase

1. Store proposals and decisions in an application database such as Supabase, not as unpublished edits in the live Aura graph.
2. Record the target concept/edge, old value, proposed value, source IDs, reason, author, timestamps, reviewer, decision and release ID.
3. Give proposals stable IDs and use optimistic concurrency so two Doctors cannot silently overwrite each other's edits.
4. Publish only approved proposals to Aura through a backend service. The browser must never receive graph write credentials or arbitrary Cypher access.
5. Preserve the previous graph release and provide a tested rollback path.
6. Keep all 42 existing package relationships as `candidate_for_review` until their evidence has been individually checked. Do not bulk-approve them.

This is a proposed permission model for team agreement, not a claim that these permissions or tables already exist.


## Phase 2 implementation boundary

The first implementation stores structured draft proposals, review decisions, permission grants and audit events in Supabase. It does not modify the source bibliography JSON or the active Aura graph. An approved proposal is marked as approved for future release only. Publishing remains unavailable until versioned graph releases, verified backups and rollback are implemented.

The Admin UI can grant/revoke the independent \`kg_reviewer\` and \`kg_curator\` capabilities. Granting \`kg_reviewer\` is the explicit step that enables the review queue. The proposal API checks this permission, and the database review function also checks it and prevents self-review.
