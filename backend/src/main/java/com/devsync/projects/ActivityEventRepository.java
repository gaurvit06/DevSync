package com.devsync.projects;

public interface ActivityEventRepository
    extends org.springframework.data.jpa.repository.JpaRepository<ActivityEvent, Long> {
  org.springframework.data.domain.Page<ActivityEvent> findByProjectIdOrderByIdDesc(
      Long projectId, org.springframework.data.domain.Pageable pageable);
}
