package com.devsync.projects;

import com.devsync.shared.AuditedEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "project_members")
public class ProjectMember extends AuditedEntity {
  public Long projectId;
  public Long userId;
  public String role;
}
