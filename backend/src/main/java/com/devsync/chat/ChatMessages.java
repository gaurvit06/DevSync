package com.devsync.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

final class ChatMessages {
  static final int PAGE_SIZE = 40;

  record Post(@NotBlank @Size(max = 4000) String content) {}

  record MessageView(
      long id,
      long authorId,
      String author,
      String authorRole,
      String content,
      Instant createdAt) {}

  record MessagePage(List<MessageView> messages, boolean hasOlder) {}

  private ChatMessages() {}
}
