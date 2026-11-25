package com.devsync.chat;

import com.devsync.chat.ChatMessages.*;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/direct-messages")
class DirectChatController {
  private final DirectChatService chat;

  DirectChatController(DirectChatService chat) {
    this.chat = chat;
  }

  @GetMapping
  List<DirectChatService.Contact> contacts(Authentication auth) {
    return chat.contacts(Long.parseLong(auth.getName()));
  }

  @GetMapping("/{recipient}")
  MessagePage list(
      Authentication auth,
      @PathVariable long recipient,
      @RequestParam(required = false) Long before,
      @RequestParam(required = false) Long project) {
    return chat.list(Long.parseLong(auth.getName()), recipient, before, project);
  }

  @PostMapping("/{recipient}")
  @ResponseStatus(HttpStatus.CREATED)
  MessageView post(
      Authentication auth,
      @PathVariable long recipient,
      @Valid @RequestBody Post request,
      @RequestParam(required = false) Long project) {
    return chat.post(Long.parseLong(auth.getName()), recipient, request.content(), project);
  }
}
