package com.devsync.projects;

import com.devsync.shared.AuditedEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "project_invitations")
public class ProjectInvitation extends AuditedEntity {
  public Long projectId;
  public Long recipientId;
  public String status;
}
