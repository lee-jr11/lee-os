-- P1.5: lifecycle revisions and explicitly reviewed, scope-safe structured memory.
ALTER TABLE projects ADD COLUMN lifecycle_version integer NOT NULL DEFAULT 0 CHECK(lifecycle_version>=0);
ALTER TABLE automations ADD COLUMN lifecycle_version integer NOT NULL DEFAULT 0 CHECK(lifecycle_version>=0);

ALTER TABLE memories ADD COLUMN scope text NOT NULL DEFAULT 'project'
 CHECK(scope IN ('owner','project','automation'));
ALTER TABLE memories ADD COLUMN automation_id text;
ALTER TABLE memories ADD COLUMN summary text NOT NULL DEFAULT '';
ALTER TABLE memories ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE memories ADD COLUMN retrieval_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE memories ADD COLUMN attestation text NOT NULL DEFAULT 'legacy'
 CHECK(attestation IN ('legacy','owner-reviewed'));
ALTER TABLE memories ADD COLUMN reviewed_at timestamptz;

-- Legacy rows remain intact and excluded from retrieval. Their evidence scope is
-- deliberately not guessed or repaired during migration.
UPDATE memories SET scope=CASE WHEN project_id IS NULL THEN 'owner' ELSE 'project' END,
 summary=COALESCE(content->>'summary',''), retrieval_enabled=false,
 attestation='legacy', reviewed_at=NULL;

ALTER TABLE memories DROP CONSTRAINT memories_source_artifact_id_fkey;
ALTER TABLE memories ADD CONSTRAINT memories_project_artifact_scope_fk
 FOREIGN KEY(project_id,source_artifact_id) REFERENCES artifacts(project_id,id) NOT VALID;
ALTER TABLE memories ADD CONSTRAINT memories_projectless_no_artifact_check
 CHECK(project_id IS NOT NULL OR source_artifact_id IS NULL) NOT VALID;
ALTER TABLE memories ADD CONSTRAINT memories_automation_scope_fk
 FOREIGN KEY(automation_id,project_id) REFERENCES automations(id,project_id) NOT VALID;
ALTER TABLE memories ADD CONSTRAINT memories_scope_shape_check CHECK(
 (scope='owner' AND project_id IS NULL AND automation_id IS NULL AND source_artifact_id IS NULL)
 OR (scope='project' AND project_id IS NOT NULL AND automation_id IS NULL)
 OR (scope='automation' AND project_id IS NOT NULL AND automation_id IS NOT NULL)
) NOT VALID;
ALTER TABLE memories ADD CONSTRAINT memories_review_gate_check CHECK(
 (retrieval_enabled=false AND reviewed_at IS NULL)
 OR (retrieval_enabled=true AND attestation='owner-reviewed' AND reviewed_at IS NOT NULL AND length(trim(summary)) BETWEEN 1 AND 500)
);
ALTER TABLE memories ADD CONSTRAINT memories_summary_length_check CHECK(length(summary)<=500);
ALTER TABLE memories ADD CONSTRAINT memories_tags_check CHECK(
 cardinality(tags)<=20 AND array_position(tags,'') IS NULL
);
CREATE INDEX memories_retrieval_project_idx ON memories(project_id,scope,updated_at DESC) WHERE retrieval_enabled;
CREATE INDEX memories_retrieval_tags_idx ON memories USING gin(tags) WHERE retrieval_enabled;
