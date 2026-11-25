package com.devsync.projects;

import com.devsync.shared.AuditedEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "activity_events")
public class ActivityEvent extends AuditedEntity {
  public Long projectId;
  public Long actorId;
  public Long workItemId;
  public String event;

  @Column(columnDefinition = "text")
  public String oldValue;

  @Column(columnDefinition = "text")
  public String newValue;
}
