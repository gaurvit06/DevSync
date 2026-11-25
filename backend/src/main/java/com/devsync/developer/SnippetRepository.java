package com.devsync.developer;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SnippetRepository extends JpaRepository<Snippet, Long> {
  Page<Snippet> findByProjectIdAndTitleContainingIgnoreCaseOrderByIdDesc(
      long projectId, String title, Pageable pageable);

  Optional<Snippet> findByIdAndProjectId(long id, long projectId);
}
