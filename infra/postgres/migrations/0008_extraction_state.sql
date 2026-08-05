-- 0008 — record WHEN a revision was put through relationship extraction.
--
-- THE GAP THIS CLOSES, found by tracing a new file end to end rather than assuming:
--
--     a new document today gets  chunks ✓   embeddings ✓ (on the GPU)   graph spine ✓
--                               extracted relationships ✗
--
-- Ingestion runs the deterministic projection (Document -> DocumentRevision -> Section) but never
-- the model. So once the full extraction pass finishes, every document written afterwards would
-- carry a permanent hole in the graph, and nothing would say so — the revision would read as
-- `graph_projected`, which it is, and the absence would be invisible.
--
-- WHY A COLUMN AND NOT "revisions with no extracted edges". That query looks equivalent and is
-- not: a revision whose text genuinely states no relationship has zero edges FOREVER, so it would
-- be re-extracted on every pass, at ~11s a chunk, until the end of time. The distinction between
-- "not tried" and "tried and found nothing" cannot be derived from the result; it has to be
-- recorded.

ALTER TABLE graph_projection_state
  ADD COLUMN extracted_at        timestamptz,
  ADD COLUMN extracted_model     text,
  ADD COLUMN extracted_count     integer CHECK (extracted_count IS NULL OR extracted_count >= 0),
  ADD COLUMN extraction_rejected integer CHECK (extraction_rejected IS NULL OR extraction_rejected >= 0);

COMMENT ON COLUMN graph_projection_state.extracted_at IS
  'When the model last ran over this revision. NULL means NOT TRIED — which is different from tried-and-found-nothing, and that difference is why this is a column rather than a query over the edges.';
COMMENT ON COLUMN graph_projection_state.extracted_model IS
  'Which model produced them. A model change is a reason to re-extract, and without this the corpus would be a silent mixture of whatever was default at the time.';

-- The pending set, as a view, so "what still needs extracting" has ONE definition rather than a
-- WHERE clause copied into every caller.
CREATE VIEW revisions_pending_extraction AS
SELECT dr.id            AS revision_id,
       d.id             AS document_id,
       d.source_path,
       d.namespace,
       gps.extracted_at,
       gps.extracted_model
FROM document_revisions dr
JOIN documents d ON d.id = dr.document_id
LEFT JOIN graph_projection_state gps ON gps.revision_id = dr.id
WHERE dr.is_current
  AND gps.extracted_at IS NULL;

GRANT SELECT ON revisions_pending_extraction TO mk_app, mk_reader;

COMMENT ON VIEW revisions_pending_extraction IS
  'Current revisions the extraction model has never seen. One definition, so a caller cannot quietly disagree with the gate about what is outstanding.';
