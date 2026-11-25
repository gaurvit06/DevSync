package com.devsync.projects;

import com.devsync.discussion.*;
import com.devsync.identity.*;
import com.devsync.notifications.*;
import com.devsync.workitems.*;
import java.net.URI;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class WorkspaceService {
  private final ProjectRepository projects;
  private final ProjectMemberRepository members;
  private final ProjectInvitationRepository invitations;
  private final UserRepository users;
  private final WorkItemRepository items;
  private final BugDetailsRepository bugs;
  private final CommentRepository comments;
  private final NotificationRepository notifications;
  private final ActivityEventRepository events;
  private final Clock clock;

  public WorkspaceService(
      ProjectRepository p,
      ProjectMemberRepository m,
      ProjectInvitationRepository i,
      UserRepository u,
      WorkItemRepository w,
      BugDetailsRepository b,
      CommentRepository c,
      NotificationRepository n,
      ActivityEventRepository e,
      Clock k) {
    projects = p;
    members = m;
    invitations = i;
    users = u;
    items = w;
    bugs = b;
    comments = c;
    notifications = n;
    events = e;
    clock = k;
  }

  public static void require(boolean ok, String message) {
    if (!ok) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }

  public static void denied() {
    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access");
  }

  public <T> T found(Optional<T> v) {
    return v.orElseThrow(
        () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found"));
  }

  public ProjectMember member(long project, long actor) {
    var m = members.findByProjectIdAndUserId(project, actor);
    if (m.isEmpty()) denied();
    return m.get();
  }

  public void manager(long project, long actor) {
    if (!member(project, actor).role.equals("MANAGER")) denied();
  }

  public Map<String, Object> map(Object... pairs) {
    var out = new LinkedHashMap<String, Object>();
    for (int i = 0; i < pairs.length; i += 2) out.put(pairs[i].toString(), pairs[i + 1]);
    return out;
  }

  public void event(long p, long actor, Long item, String type, String old, String value) {
    var e = new ActivityEvent();
    e.projectId = p;
    e.actorId = actor;
    e.workItemId = item;
    e.event = type;
    e.oldValue = old;
    e.newValue = value;
    events.save(e);
  }

  public Map<String, Object> projectView(Project p, long actor) {
    return map(
        "id",
        p.id,
        "name",
        p.name,
        "description",
        p.description,
        "deadline",
        p.deadline,
        "timezone",
        p.timezone,
        "role",
        member(p.id, actor).role);
  }

  public List<?> projectList(long actor) {
    return members.findByUserId(actor).stream()
        .map(m -> projectView(found(projects.findById(m.projectId)), actor))
        .toList();
  }

  public Object projectSave(long actor, Long id, Map<String, Object> d) {
    Project p;
    if (id == null) {
      p = new Project();
    } else {
      manager(id, actor);
      p = found(projects.findById(id));
    }
    p.name = text(d, "name", true, 100);
    p.description = text(d, "description", false, 10000);
    p.timezone = Objects.toString(d.getOrDefault("timezone", "Asia/Kolkata"));
    ZoneId.of(p.timezone);
    p.deadline = date(d.get("deadline"));
    projects.save(p);
    if (id == null) {
      var m = new ProjectMember();
      m.projectId = p.id;
      m.userId = actor;
      m.role = "MANAGER";
      members.save(m);
    }
    event(p.id, actor, null, id == null ? "PROJECT_CREATED" : "PROJECT_UPDATED", null, p.name);
    return projectView(p, actor);
  }

  public Object memberList(long actor, long p) {
    member(p, actor);
    return members.findByProjectId(p).stream()
        .map(
            m -> {
              var u = found(users.findById(m.userId));
              return map("id", m.id, "userId", u.id, "name", u.name, "role", m.role);
            })
        .toList();
  }

  public Object invite(long actor, long p, String email) {
    manager(p, actor);
    require(email != null && !email.isBlank(), "Enter your teammate's email address.");
    var u =
        users
            .findByEmail(email.trim().toLowerCase(Locale.ROOT))
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "No DevSync account found. Ask your teammate to create an account with this"
                            + " email first."));
    require(
        members.findByProjectIdAndUserId(p, u.id).isEmpty(),
        "This teammate is already a project member.");
    require(
        invitations.findByRecipientId(u.id).stream()
            .noneMatch(i -> i.projectId == p && i.status.equals("PENDING")),
        "An invite is already pending in this teammate's DevSync Inbox.");
    var i = new ProjectInvitation();
    i.projectId = p;
    i.recipientId = u.id;
    i.status = "PENDING";
    invitations.save(i);
    event(p, actor, null, "INVITED", null, u.name);
    return map("id", i.id, "status", i.status);
  }

  public List<?> pendingInvitations(long actor, long projectId) {
    manager(projectId, actor);
    return invitations.findByProjectIdAndStatusOrderByIdDesc(projectId, "PENDING").stream()
        .map(
            invitation -> {
              var recipient = found(users.findById(invitation.recipientId));
              return map("id", invitation.id, "name", recipient.name, "email", recipient.email);
            })
        .toList();
  }

  public List<?> inbox(long actor) {
    return invitations.findByRecipientId(actor).stream()
        .filter(i -> i.status.equals("PENDING"))
        .map(
            i ->
                map(
                    "id",
                    i.id,
                    "projectId",
                    i.projectId,
                    "projectName",
                    found(projects.findById(i.projectId)).name,
                    "status",
                    i.status))
        .toList();
  }

  public void respond(long actor, long id, boolean accept) {
    var i = found(invitations.findById(id));
    if (i.recipientId != actor) denied();
    require(i.status.equals("PENDING"), "Invitation already answered");
    i.status = accept ? "ACCEPTED" : "DECLINED";
    if (accept && members.findByProjectIdAndUserId(i.projectId, actor).isEmpty()) {
      var m = new ProjectMember();
      m.projectId = i.projectId;
      m.userId = actor;
      m.role = "DEVELOPER";
      members.save(m);
    }
    event(i.projectId, actor, null, "INVITATION_" + i.status, null, null);
  }

  public void changeMember(long actor, long p, long user, String role, boolean remove) {
    manager(p, actor);
    var m = found(members.findByProjectIdAndUserId(p, user));
    require(remove || Set.of("MANAGER", "DEVELOPER").contains(role), "Invalid role");
    if (m.role.equals("MANAGER") && (remove || !role.equals("MANAGER")))
      require(
          members.findByProjectId(p).stream().filter(x -> x.role.equals("MANAGER")).count() > 1,
          "Cannot remove the final manager");
    if (remove) {
      for (var w : items.findByProjectIdOrderByIdDesc(p))
        if (Objects.equals(w.assigneeId, user) && !w.status.equals("DONE")) {
          w.assigneeId = null;
          event(p, actor, w.id, "ASSIGNEE", String.valueOf(user), null);
        }
      members.delete(m);
    } else m.role = role;
    event(p, actor, null, remove ? "MEMBER_REMOVED" : "ROLE_CHANGED", String.valueOf(user), role);
  }

  public WorkItem accessItem(long actor, long id) {
    var w = found(items.findById(id));
    member(w.projectId, actor);
    return w;
  }

  public Map<String, Object> itemView(WorkItem w) {
    return map(
        "id",
        w.id,
        "projectId",
        w.projectId,
        "title",
        w.title,
        "description",
        w.description,
        "reviewUrl",
        w.reviewUrl,
        "type",
        w.type,
        "assigneeId",
        w.assigneeId,
        "priority",
        w.priority,
        "status",
        w.status,
        "deadline",
        w.deadline,
        "creatorId",
        w.creatorId,
        "version",
        w.version,
        "createdAt",
        w.createdAt,
        "bug",
        bugs.findByWorkItemId(w.id)
            .map(
                b ->
                    map(
                        "severity",
                        b.severity,
                        "steps",
                        b.steps,
                        "expectedBehavior",
                        b.expectedBehavior,
                        "actualBehavior",
                        b.actualBehavior,
                        "category",
                        b.category))
            .orElse(null));
  }

  public boolean overdue(WorkItem w) {
    return overdueAt(w, clock);
  }

  public boolean overdueAt(WorkItem w, Clock at) {
    return isOverdue(
        w, LocalDate.now(at.withZone(ZoneId.of(found(projects.findById(w.projectId)).timezone))));
  }

  private boolean isOverdue(WorkItem w, LocalDate today) {
    return !w.status.equals("DONE") && w.deadline != null && w.deadline.isBefore(today);
  }

  public Object itemList(long actor, long p, Map<String, String> filters, int page, int size) {
    member(p, actor);
    int limit = Math.clamp(size, 1, 100);
    var all =
        items.findByProjectIdOrderByIdDesc(p).stream()
            .filter(
                w ->
                    filters.getOrDefault("q", "").isBlank()
                        || (w.title + " " + w.description)
                            .toLowerCase(Locale.ROOT)
                            .contains(filters.get("q").toLowerCase(Locale.ROOT)))
            .filter(
                w ->
                    match(filters, "status", w.status)
                        && match(filters, "priority", w.priority)
                        && match(filters, "type", w.type)
                        && match(filters, "assigneeId", Objects.toString(w.assigneeId, "")))
            .filter(w -> !filters.getOrDefault("overdue", "").equals("true") || overdue(w))
            .toList();
    return map(
        "total",
        all.size(),
        "page",
        Math.max(0, page),
        "size",
        limit,
        "items",
        all.stream()
            .skip((long) Math.max(page, 0) * limit)
            .limit(limit)
            .map(this::itemView)
            .toList());
  }

  private boolean match(Map<String, String> f, String k, String value) {
    return f.getOrDefault(k, "").isBlank() || f.get(k).equals(value);
  }

  public Object saveItem(long actor, long p, Long id, Map<String, Object> d) {
    member(p, actor);
    boolean fresh = id == null;
    var w = fresh ? new WorkItem() : accessItem(actor, id);
    require(fresh || w.projectId == p, "Wrong project");
    if (!fresh
        && (!d.containsKey("version")
            || !Objects.equals(w.version, Long.valueOf(d.get("version").toString()))))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "This item changed. Reload before saving.");
    String oldStatus = w.status, oldPriority = w.priority;
    Long oldAssignee = w.assigneeId;
    w.projectId = p;
    w.title = text(d, "title", true, 200);
    w.description = text(d, "description", false, 10000);
    if (d.containsKey("reviewUrl")) {
      String link = text(d, "reviewUrl", false, 2048);
      if (!link.isEmpty()) {
        URI uri;
        try {
          uri = URI.create(link);
        } catch (IllegalArgumentException error) {
          throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST, "Enter a valid pull request URL.");
        }
        require(
            uri.getHost() != null
                && uri.getUserInfo() == null
                && ("https".equalsIgnoreCase(uri.getScheme())
                    || "http".equalsIgnoreCase(uri.getScheme())),
            "Use an HTTP or HTTPS link without credentials.");
      }
      w.reviewUrl = link.isEmpty() ? null : link;
    }
    w.type = choice(d, "type", Set.of("TASK", "BUG"), "TASK");
    w.status = choice(d, "status", Set.of("TODO", "IN_PROGRESS", "REVIEW", "DONE"), "TODO");
    w.priority = choice(d, "priority", Set.of("LOW", "MEDIUM", "HIGH", "URGENT"), "MEDIUM");
    w.deadline = date(d.get("deadline"));
    w.assigneeId = number(d.get("assigneeId"));
    if (w.assigneeId != null)
      require(
          members.findByProjectIdAndUserId(p, w.assigneeId).isPresent(),
          "Assignee must be a project member");
    if (fresh) w.creatorId = actor;
    items.saveAndFlush(w);
    if (w.type.equals("BUG")) {
      var b = bugs.findByWorkItemId(w.id).orElseGet(BugDetails::new);
      b.workItemId = w.id;
      @SuppressWarnings("unchecked")
      var bd = (Map<String, Object>) d.getOrDefault("bug", Map.of());
      b.severity = choice(bd, "severity", Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL"), "MEDIUM");
      b.category =
          choice(
              bd,
              "category",
              Set.of("UI", "BACKEND", "DATABASE", "AUTHENTICATION", "PERFORMANCE", "OTHER"),
              "OTHER");
      b.steps = text(bd, "steps", true, 10000);
      b.expectedBehavior = text(bd, "expectedBehavior", false, 10000);
      b.actualBehavior = text(bd, "actualBehavior", false, 10000);
      bugs.save(b);
    } else bugs.findByWorkItemId(w.id).ifPresent(bugs::delete);
    if (fresh) event(p, actor, w.id, "ITEM_CREATED", null, w.title);
    if (!Objects.equals(oldStatus, w.status)) {
      event(p, actor, w.id, "STATUS", oldStatus, w.status);
      if (!fresh) notifyParticipants(w, actor, "Status changed: " + w.title);
    }
    if (!Objects.equals(oldPriority, w.priority))
      event(p, actor, w.id, "PRIORITY", oldPriority, w.priority);
    if (!Objects.equals(oldAssignee, w.assigneeId)) {
      event(
          p,
          actor,
          w.id,
          "ASSIGNEE",
          Objects.toString(oldAssignee, null),
          Objects.toString(w.assigneeId, null));
      if (w.assigneeId != null) notifyOne(w, actor, w.assigneeId, "Assigned: " + w.title);
    }
    return itemView(w);
  }

  public void deleteItem(long actor, long id) {
    var w = accessItem(actor, id);
    manager(w.projectId, actor);
    event(w.projectId, actor, null, "ITEM_DELETED", w.title, null);
    items.delete(w);
    items.flush();
  }

  private void notifyOne(WorkItem w, long actor, long recipient, String message) {
    if (actor == recipient || members.findByProjectIdAndUserId(w.projectId, recipient).isEmpty())
      return;
    var n = new Notification();
    n.recipientId = recipient;
    n.projectId = w.projectId;
    n.workItemId = w.id;
    n.message = message;
    notifications.save(n);
  }

  public void notifyParticipants(WorkItem w, long actor, String message) {
    var recipients = new HashSet<Long>();
    recipients.add(w.creatorId);
    if (w.assigneeId != null) recipients.add(w.assigneeId);
    comments.findByWorkItemIdOrderByIdAsc(w.id).forEach(c -> recipients.add(c.authorId));
    recipients.forEach(r -> notifyOne(w, actor, r, message));
  }

  public Object commentList(long actor, long id) {
    accessItem(actor, id);
    return comments.findByWorkItemIdOrderByIdAsc(id).stream()
        .map(
            c ->
                map(
                    "id",
                    c.id,
                    "authorId",
                    c.authorId,
                    "authorName",
                    found(users.findById(c.authorId)).name,
                    "content",
                    c.content,
                    "createdAt",
                    c.createdAt))
        .toList();
  }

  public Object addComment(long actor, long id, Map<String, Object> d) {
    var w = accessItem(actor, id);
    var c = new Comment();
    c.workItemId = id;
    c.authorId = actor;
    c.content = text(d, "content", true, 5000);
    comments.save(c);
    notifyParticipants(w, actor, "Comment on: " + w.title);
    return map("id", c.id);
  }

  public void editComment(long actor, long id, Map<String, Object> d, boolean remove) {
    var c = found(comments.findById(id));
    var w = accessItem(actor, c.workItemId);
    if (c.authorId != actor) {
      if (!remove) denied();
      manager(w.projectId, actor);
    }
    if (remove) comments.delete(c);
    else c.content = text(d, "content", true, 5000);
  }

  public long unreadCount(long actor) {
    return notifications.countByRecipientIdAndIsReadFalse(actor);
  }

  public Object notificationList(long actor) {
    return notifications.findTop100ByRecipientIdOrderByIdDesc(actor).stream()
        .map(
            n ->
                map(
                    "id",
                    n.id,
                    "projectId",
                    n.projectId,
                    "workItemId",
                    n.workItemId,
                    "message",
                    n.message,
                    "read",
                    n.isRead,
                    "createdAt",
                    n.createdAt))
        .toList();
  }

  public void readNotification(long actor, long id) {
    var n = found(notifications.findById(id));
    if (n.recipientId != actor) denied();
    n.isRead = true;
  }

  public Map<String, Object> dashboard(long actor, long p) {
    member(p, actor);
    var all = items.findByProjectIdOrderByIdDesc(p);
    var statuses = new LinkedHashMap<String, Long>();
    for (var s : List.of("TODO", "IN_PROGRESS", "REVIEW", "DONE"))
      statuses.put(s, all.stream().filter(w -> w.status.equals(s)).count());
    var severities = new LinkedHashMap<String, Long>();
    for (var s : List.of("LOW", "MEDIUM", "HIGH", "CRITICAL"))
      severities.put(
          s,
          all.stream()
              .filter(
                  w ->
                      w.type.equals("BUG")
                          && !w.status.equals("DONE")
                          && bugs.findByWorkItemId(w.id)
                              .map(b -> b.severity.equals(s))
                              .orElse(false))
              .count());
    var workload =
        members.findByProjectId(p).stream()
            .map(
                m ->
                    map(
                        "name",
                        found(users.findById(m.userId)).name,
                        "count",
                        all.stream()
                            .filter(
                                w ->
                                    !w.status.equals("DONE")
                                        && Objects.equals(w.assigneeId, m.userId))
                            .count()))
            .toList();
    return map(
        "total",
        all.size(),
        "tasks",
        all.stream().filter(w -> w.type.equals("TASK")).count(),
        "bugs",
        all.stream().filter(w -> w.type.equals("BUG")).count(),
        "statuses",
        statuses,
        "completion",
        all.isEmpty() ? 0 : 100.0 * statuses.get("DONE") / all.size(),
        "overdue",
        all.stream().filter(this::overdue).count(),
        "severity",
        severities,
        "workload",
        workload);
  }

  public String bugSteps(long id) {
    return bugs.findByWorkItemId(id).map(b -> b.steps).orElse("");
  }

  public Map<String, Object> summaryFacts(long actor, long p) {
    var facts = dashboard(actor, p);
    facts.remove("workload");
    var work = items.findByProjectIdOrderByIdDesc(p);
    var project = found(projects.findById(p));
    var today = LocalDate.now(clock.withZone(ZoneId.of(project.timezone)));
    facts.put(
        "completedWork",
        work.stream().filter(w -> w.status.equals("DONE")).limit(5).map(w -> w.title).toList());
    var attention = new LinkedHashMap<Long, Map<String, Object>>();
    work.stream()
        .filter(w -> isOverdue(w, today))
        .sorted(Comparator.comparing(w -> w.deadline))
        .limit(5)
        .forEach(
            w ->
                attention.put(
                    w.id,
                    map("id", w.id, "title", w.title, "reason", "Overdue since " + w.deadline)));
    for (String level : List.of("CRITICAL", "HIGH")) {
      work.stream()
          .filter(w -> w.type.equals("BUG") && !w.status.equals("DONE"))
          .filter(w -> bugs.findByWorkItemId(w.id).map(b -> level.equals(b.severity)).orElse(false))
          .limit(5)
          .forEach(
              w ->
                  attention.putIfAbsent(
                      w.id,
                      map(
                          "id",
                          w.id,
                          "title",
                          w.title,
                          "reason",
                          level.equals("CRITICAL")
                              ? "Critical open bug"
                              : "High-severity open bug")));
    }
    work.stream()
        .filter(w -> w.status.equals("REVIEW"))
        .limit(5)
        .forEach(
            w ->
                attention.putIfAbsent(
                    w.id, map("id", w.id, "title", w.title, "reason", "Waiting for review")));
    facts.put("attention", attention.values().stream().limit(5).toList());
    return facts;
  }

  public List<?> portfolio(long actor) {
    return members.findByUserId(actor).stream()
        .map(
            membership -> {
              Project project = found(projects.findById(membership.projectId));
              var work = items.findByProjectIdOrderByIdDesc(project.id);
              var today = LocalDate.now(clock.withZone(ZoneId.of(project.timezone)));
              return map(
                  "id",
                  project.id,
                  "name",
                  project.name,
                  "role",
                  membership.role,
                  "total",
                  work.size(),
                  "completed",
                  work.stream().filter(w -> w.status.equals("DONE")).count(),
                  "tasksInProgress",
                  work.stream()
                      .filter(w -> w.type.equals("TASK") && w.status.equals("IN_PROGRESS"))
                      .count(),
                  "bugsInProgress",
                  work.stream()
                      .filter(w -> w.type.equals("BUG") && w.status.equals("IN_PROGRESS"))
                      .count(),
                  "openBugs",
                  work.stream()
                      .filter(w -> w.type.equals("BUG") && !w.status.equals("DONE"))
                      .count(),
                  "review",
                  work.stream().filter(w -> w.status.equals("REVIEW")).count(),
                  "overdue",
                  work.stream().filter(w -> isOverdue(w, today)).count());
            })
        .toList();
  }

  public Object activity(long actor, long p, int page) {
    manager(p, actor);
    return events
        .findByProjectIdOrderByIdDesc(
            p, org.springframework.data.domain.PageRequest.of(Math.max(0, page), 30))
        .map(
            e ->
                map(
                    "id",
                    e.id,
                    "actor",
                    found(users.findById(e.actorId)).name,
                    "event",
                    e.event,
                    "oldValue",
                    e.oldValue,
                    "newValue",
                    e.newValue,
                    "createdAt",
                    e.createdAt))
        .getContent();
  }

  public static String text(Map<String, Object> d, String k, boolean needed, int max) {
    String s = Objects.toString(d.get(k), "").trim();
    require(!needed || !s.isBlank(), k + " is required");
    require(s.length() <= max, k + " is too long");
    return s;
  }

  public static String choice(
      Map<String, Object> d, String k, Set<String> options, String fallback) {
    String s = Objects.toString(d.get(k), fallback);
    require(options.contains(s), "Invalid " + k);
    return s;
  }

  public static Long number(Object v) {
    return v == null || v.toString().isBlank() ? null : Long.valueOf(v.toString());
  }

  public static LocalDate date(Object v) {
    return v == null || v.toString().isBlank() ? null : LocalDate.parse(v.toString());
  }
}
