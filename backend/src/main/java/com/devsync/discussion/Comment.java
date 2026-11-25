package com.devsync.discussion;

import com.devsync.shared.AuditedEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "comments")
public class Comment extends AuditedEntity {
  public Long workItemId;
  public Long authorId;

  @Column(columnDefinition = "text")
  public String content;
}
