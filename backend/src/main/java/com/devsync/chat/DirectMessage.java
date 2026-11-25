package com.devsync.chat;

import com.devsync.shared.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "direct_messages")
class DirectMessage extends AuditedEntity {
  Long userLowId;
  Long userHighId;
  Long authorId;

  @Column(columnDefinition = "text")
  String content;

  long otherParticipant(long actor) {
    return userLowId == actor ? userHighId : userLowId;
  }
}
