package com.devsync.notifications;

import com.devsync.shared.AuditedEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "notifications")
public class Notification extends AuditedEntity {
  public Long recipientId;
  public Long projectId;
  public Long workItemId;
  public String message;
  public boolean isRead;
}
