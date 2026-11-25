package com.devsync.chat;

import com.devsync.chat.ChatMessages.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{project}/messages")
public class ProjectChatController {
  private final ProjectChatService chat;

  public ProjectChatController(ProjectChatService chat) {
    this.chat = chat;
  }

  @GetMapping
  MessagePage list(
      Authentication auth,
      @PathVariable long project,
      @RequestParam(required = false) Long before) {
    return chat.list(project, Long.parseLong(auth.getName()), before);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  MessageView post(
      Authentication auth, @PathVariable long project, @Valid @RequestBody Post request) {
    return chat.post(project, Long.parseLong(auth.getName()), request.content());
  }
}
