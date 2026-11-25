package com.devsync.projects;

import com.devsync.shared.AuditedEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "projects")
public class Project extends AuditedEntity {
  public String name;

  @Column(columnDefinition = "text")
  public String description;

  public java.time.LocalDate deadline;
  public String timezone;
}
