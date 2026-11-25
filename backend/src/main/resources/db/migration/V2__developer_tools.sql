ALTER TABLE work_items ADD COLUMN review_url VARCHAR(2048) NULL;

CREATE TABLE developer_snippets (
  id BIGINT NOT NULL AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  author_id BIGINT NOT NULL,
  title VARCHAR(100) NOT NULL,
  language VARCHAR(24) NOT NULL,
  content TEXT NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_snippet_project_id (project_id, id),
  CONSTRAINT fk_snippet_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_snippet_author FOREIGN KEY (author_id) REFERENCES users(id)
);
