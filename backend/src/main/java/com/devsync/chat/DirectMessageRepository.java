package com.devsync.chat;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface DirectMessageRepository extends JpaRepository<DirectMessage, Long> {
  List<DirectMessage> findByUserLowIdAndUserHighIdAndIdLessThanOrderByIdDesc(
      long userLowId, long userHighId, long before, Pageable limit);

  boolean existsByUserLowIdAndUserHighId(long userLowId, long userHighId);

  @Query(
      value =
          """
          SELECT MAX(id) FROM direct_messages WHERE user_low_id = :actor GROUP BY user_high_id
          UNION ALL
          SELECT MAX(id) FROM direct_messages WHERE user_high_id = :actor GROUP BY user_low_id
          """,
      nativeQuery = true)
  List<Long> latestMessageIds(long actor);
}
