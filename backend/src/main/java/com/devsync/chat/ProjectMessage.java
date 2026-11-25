package com.devsync.chat;

import com.devsync.shared.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_messages")
public class ProjectMessage extends AuditedEntity {
  Long projectId;
  Long authorId;

  @Column(columnDefinition = "text")
  String content;
}
