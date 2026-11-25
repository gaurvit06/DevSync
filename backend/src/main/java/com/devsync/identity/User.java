package com.devsync.identity;

import com.devsync.shared.AuditedEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User extends AuditedEntity {
  public String name;
  public String email;
  @com.fasterxml.jackson.annotation.JsonIgnore public String passwordHash;
}
