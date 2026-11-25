package com.devsync.chat;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectMessageRepository extends JpaRepository<ProjectMessage, Long> {
  List<ProjectMessage> findByProjectIdAndIdLessThanOrderByIdDesc(
      long projectId, long before, Pageable limit);
}
