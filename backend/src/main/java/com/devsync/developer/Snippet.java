package com.devsync.developer;

import com.devsync.shared.AuditedEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "developer_snippets")
public class Snippet extends AuditedEntity {
  Long projectId;
  Long authorId;
  String title;
  String language;

  @Column(columnDefinition = "text")
  String content;

  @Version Long version;
}
