package com.devsync.workitems;

import com.devsync.shared.AuditedEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "bug_details")
public class BugDetails extends AuditedEntity {
  public Long workItemId;
  public String severity;

  @Column(columnDefinition = "text")
  public String steps;

  @Column(columnDefinition = "text")
  public String expectedBehavior;

  @Column(columnDefinition = "text")
  public String actualBehavior;

  public String category;
}
