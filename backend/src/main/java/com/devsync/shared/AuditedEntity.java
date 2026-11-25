package com.devsync.shared;

import jakarta.persistence.*;
import java.time.Instant;

@MappedSuperclass
public abstract class AuditedEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  public Instant createdAt = Instant.now();
  public Instant updatedAt = Instant.now();

  @PreUpdate
  void touch() {
    updatedAt = Instant.now();
  }
}
