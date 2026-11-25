package com.devsync.discussion;

public interface CommentRepository
    extends org.springframework.data.jpa.repository.JpaRepository<Comment, Long> {
  java.util.List<Comment> findByWorkItemIdOrderByIdAsc(Long workItemId);
}
