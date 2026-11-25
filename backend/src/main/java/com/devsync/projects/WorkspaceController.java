package com.devsync.projects;

import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class WorkspaceController {
  private final WorkspaceService s;

  public WorkspaceController(WorkspaceService service) {
    s = service;
  }

  long actor(Authentication a) {
    return Long.parseLong(a.getName());
  }

  @GetMapping("/projects")
  Object projects(Authentication a) {
    return s.projectList(actor(a));
  }

  @GetMapping("/portfolio")
  Object portfolio(Authentication a) {
    return s.portfolio(actor(a));
  }

  @PostMapping("/projects")
  Object create(Authentication a, @RequestBody Map<String, Object> d) {
    return s.projectSave(actor(a), null, d);
  }

  @PutMapping("/projects/{p}")
  Object edit(Authentication a, @PathVariable long p, @RequestBody Map<String, Object> d) {
    return s.projectSave(actor(a), p, d);
  }

  @GetMapping("/projects/{p}/members")
  Object members(Authentication a, @PathVariable long p) {
    return s.memberList(actor(a), p);
  }

  @PostMapping("/projects/{p}/invitations")
  Object invite(Authentication a, @PathVariable long p, @RequestBody Map<String, String> d) {
    return s.invite(actor(a), p, d.getOrDefault("email", ""));
  }

  @GetMapping("/projects/{p}/invitations")
  Object pendingInvitations(Authentication a, @PathVariable long p) {
    return s.pendingInvitations(actor(a), p);
  }

  @GetMapping("/invitations")
  Object inbox(Authentication a) {
    return s.inbox(actor(a));
  }

  @PostMapping("/invitations/{id}/respond")
  void respond(Authentication a, @PathVariable long id, @RequestBody Map<String, Boolean> d) {
    s.respond(actor(a), id, Boolean.TRUE.equals(d.get("accept")));
  }

  @PutMapping("/projects/{p}/members/{u}")
  void role(
      Authentication a,
      @PathVariable long p,
      @PathVariable long u,
      @RequestBody Map<String, String> d) {
    s.changeMember(actor(a), p, u, d.get("role"), false);
  }

  @DeleteMapping("/projects/{p}/members/{u}")
  void remove(Authentication a, @PathVariable long p, @PathVariable long u) {
    s.changeMember(actor(a), p, u, "", true);
  }

  @GetMapping("/projects/{p}/work-items")
  Object list(
      Authentication a,
      @PathVariable long p,
      @RequestParam Map<String, String> f,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return s.itemList(actor(a), p, f, page, size);
  }

  @PostMapping("/projects/{p}/work-items")
  Object createItem(Authentication a, @PathVariable long p, @RequestBody Map<String, Object> d) {
    return s.saveItem(actor(a), p, null, d);
  }

  @GetMapping("/work-items/{id}")
  Object item(Authentication a, @PathVariable long id) {
    return s.itemView(s.accessItem(actor(a), id));
  }

  @PutMapping("/work-items/{id}")
  Object save(Authentication a, @PathVariable long id, @RequestBody Map<String, Object> d) {
    var w = s.accessItem(actor(a), id);
    return s.saveItem(actor(a), w.projectId, id, d);
  }

  @DeleteMapping("/work-items/{id}")
  void delete(Authentication a, @PathVariable long id) {
    s.deleteItem(actor(a), id);
  }

  @GetMapping("/work-items/{id}/comments")
  Object comments(Authentication a, @PathVariable long id) {
    return s.commentList(actor(a), id);
  }

  @PostMapping("/work-items/{id}/comments")
  Object comment(Authentication a, @PathVariable long id, @RequestBody Map<String, Object> d) {
    return s.addComment(actor(a), id, d);
  }

  @PutMapping("/comments/{id}")
  void editComment(Authentication a, @PathVariable long id, @RequestBody Map<String, Object> d) {
    s.editComment(actor(a), id, d, false);
  }

  @DeleteMapping("/comments/{id}")
  void deleteComment(Authentication a, @PathVariable long id) {
    s.editComment(actor(a), id, Map.of(), true);
  }

  @GetMapping("/notifications/unread-count")
  Object unread(Authentication a) {
    return java.util.Map.of("count", s.unreadCount(actor(a)));
  }

  @GetMapping("/notifications")
  Object notifications(Authentication a) {
    return s.notificationList(actor(a));
  }

  @PostMapping("/notifications/{id}/read")
  void read(Authentication a, @PathVariable long id) {
    s.readNotification(actor(a), id);
  }

  @GetMapping("/projects/{p}/dashboard")
  Object dashboard(Authentication a, @PathVariable long p) {
    return s.dashboard(actor(a), p);
  }

  @GetMapping("/projects/{p}/activity")
  Object activity(
      Authentication a, @PathVariable long p, @RequestParam(defaultValue = "0") int page) {
    return s.activity(actor(a), p, page);
  }
}
