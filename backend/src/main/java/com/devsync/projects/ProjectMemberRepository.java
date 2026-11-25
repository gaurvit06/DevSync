package com.devsync.projects;

import java.util.List;
import org.springframework.data.jpa.repository.Query;

public interface ProjectMemberRepository
    extends org.springframework.data.jpa.repository.JpaRepository<ProjectMember, Long> {
  java.util.Optional<ProjectMember> findByProjectIdAndUserId(Long projectId, Long userId);

  java.util.List<ProjectMember> findByProjectId(Long projectId);

  java.util.List<ProjectMember> findByUserId(Long userId);

  @Query(
      """
      select distinct peer.userId from ProjectMember own
      join ProjectMember peer on own.projectId = peer.projectId
      where own.userId = :actor and peer.userId <> :actor
      """)
  List<Long> findTeammateIds(long actor);

  @Query(
      """
      select count(peer) > 0 from ProjectMember own
      join ProjectMember peer on own.projectId = peer.projectId
      where own.userId = :actor and peer.userId = :recipient
      """)
  boolean sharesProject(long actor, long recipient);
}
