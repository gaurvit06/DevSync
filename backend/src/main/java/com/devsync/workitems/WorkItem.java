package com.devsync.workitems;

import com.devsync.shared.AuditedEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "work_items")
public class WorkItem extends AuditedEntity {
  public Long projectId;
  public String title;

  @Column(columnDefinition = "text")
  public String description;

  @Column(length = 2048)
  public String reviewUrl;

  public String type;
  public Long assigneeId;
  public String priority;
  public String status;
  public java.time.LocalDate deadline;
  public Long creatorId;
  @Version public Long version;
}
