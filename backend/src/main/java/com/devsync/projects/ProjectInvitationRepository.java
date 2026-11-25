package com.devsync.projects;

public interface ProjectInvitationRepository
    extends org.springframework.data.jpa.repository.JpaRepository<ProjectInvitation, Long> {
  java.util.List<ProjectInvitation> findByRecipientId(Long recipientId);

  java.util.List<ProjectInvitation> findByProjectIdAndStatusOrderByIdDesc(
      Long projectId, String status);
}
