package com.devsync.workitems;

public interface BugDetailsRepository
    extends org.springframework.data.jpa.repository.JpaRepository<BugDetails, Long> {
  java.util.Optional<BugDetails> findByWorkItemId(Long workItemId);
}
