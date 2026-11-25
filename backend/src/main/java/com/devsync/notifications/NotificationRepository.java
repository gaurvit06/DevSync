package com.devsync.notifications;

public interface NotificationRepository
    extends org.springframework.data.jpa.repository.JpaRepository<Notification, Long> {
  long countByRecipientIdAndIsReadFalse(Long recipientId);

  java.util.List<Notification> findTop100ByRecipientIdOrderByIdDesc(Long recipientId);
}
