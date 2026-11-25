CREATE TABLE direct_messages (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_low_id BIGINT NOT NULL,
  user_high_id BIGINT NOT NULL,
  author_id BIGINT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_dm_low_high_id (user_low_id, user_high_id, id),
  INDEX idx_dm_high_low_id (user_high_id, user_low_id, id),
  CONSTRAINT fk_dm_user_low FOREIGN KEY (user_low_id) REFERENCES users(id),
  CONSTRAINT fk_dm_user_high FOREIGN KEY (user_high_id) REFERENCES users(id),
  CONSTRAINT fk_dm_author FOREIGN KEY (author_id) REFERENCES users(id),
  CONSTRAINT chk_dm_pair CHECK (user_low_id < user_high_id),
  CONSTRAINT chk_dm_author CHECK (author_id IN (user_low_id, user_high_id))
);
