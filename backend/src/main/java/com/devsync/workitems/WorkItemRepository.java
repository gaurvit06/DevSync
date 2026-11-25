package com.devsync.workitems;

public interface WorkItemRepository
    extends org.springframework.data.jpa.repository.JpaRepository<WorkItem, Long> {
  java.util.List<WorkItem> findByProjectIdOrderByIdDesc(Long projectId);
}
