package com.devsync.calls;

import com.devsync.calls.CallService.RoomKey;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/projects/{project}/call", "/api/direct-messages/{recipient}/call"})
public class CallController {
  private final CallService calls;

  public CallController(CallService calls) {
    this.calls = calls;
  }

  record Sync(UUID session, long after, CallService.Media media) {}

  record Outbound(UUID session, long target, UUID targetSession, String kind, JsonNode payload) {}

  record Leave(UUID session) {}

  @GetMapping
  CallService.Lobby lobby(Authentication auth, @PathVariable Map<String, String> route) {
    long actor = actor(auth);
    return calls.lobby(room(route, actor), actor);
  }

  @PostMapping("/join")
  CallService.Joined join(
      Authentication auth,
      @PathVariable Map<String, String> route,
      @RequestBody CallService.Media media) {
    long actor = actor(auth);
    return calls.join(room(route, actor), actor, media);
  }

  @PostMapping("/sync")
  CallService.Update sync(
      Authentication auth, @PathVariable Map<String, String> route, @RequestBody Sync tick) {
    long actor = actor(auth);
    return calls.sync(room(route, actor), actor, tick.session(), tick.after(), tick.media());
  }

  @PostMapping("/signal")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void signal(
      Authentication auth, @PathVariable Map<String, String> route, @RequestBody Outbound signal) {
    long actor = actor(auth);
    calls.signal(
        room(route, actor),
        actor,
        signal.session(),
        signal.target(),
        signal.targetSession(),
        signal.kind(),
        signal.payload());
  }

  @PostMapping("/leave")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void leave(
      Authentication auth, @PathVariable Map<String, String> route, @RequestBody Leave request) {
    long actor = actor(auth);
    calls.leave(room(route, actor), actor, request.session());
  }

  private RoomKey room(Map<String, String> route, long actor) {
    try {
      return route.containsKey("project")
          ? RoomKey.project(Long.parseLong(route.get("project")))
          : RoomKey.direct(actor, Long.parseLong(route.get("recipient")));
    } catch (NumberFormatException ex) {
      throw new org.springframework.web.server.ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Invalid call address.");
    }
  }

  private long actor(Authentication auth) {
    return Long.parseLong(auth.getName());
  }
}
