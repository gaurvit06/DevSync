package com.devsync;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

import com.devsync.insights.*;
import com.devsync.projects.*;
import com.devsync.workitems.*;
import com.fasterxml.jackson.databind.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.*;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AcceptanceTest {
  @Container static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.4");

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", mysql::getJdbcUrl);
    r.add("spring.datasource.username", mysql::getUsername);
    r.add("spring.datasource.password", mysql::getPassword);
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired WorkspaceService service;
  @Autowired WorkItemRepository items;
  @Autowired ProjectRepository projects;
  @MockitoBean ApiAiProvider remote;

  record Account(long id, String email, MockHttpSession session) {}

  Account manager, developer, outsider;
  long project;

  JsonNode body(MvcResult r) throws Exception {
    return r.getResponse().getContentAsString().isEmpty()
        ? json.nullNode()
        : json.readTree(r.getResponse().getContentAsString());
  }

  MvcResult request(Account a, String method, String url, Object data, int status)
      throws Exception {
    var b =
        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request(
                org.springframework.http.HttpMethod.valueOf(method), url)
            .with(csrf());
    if (a != null) b.session(a.session);
    if (data != null)
      b.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(data));
    var result = mvc.perform(b).andReturn();
    assertEquals(
        status,
        result.getResponse().getStatus(),
        method + " " + url + " " + result.getResponse().getContentAsString());
    return result;
  }

  Account account(String name) throws Exception {
    String email = name + UUID.randomUUID() + "@example.test";
    var d = Map.of("name", name, "email", email, "password", "Testing123!");
    long id = body(request(null, "POST", "/api/auth/register", d, 201)).path("id").asLong();
    var login = request(null, "POST", "/api/auth/login", d, 200);
    return new Account(id, email, (MockHttpSession) login.getRequest().getSession());
  }

  JsonNode create(Account a, Map<String, Object> d) throws Exception {
    return body(request(a, "POST", "/api/projects/" + project + "/work-items", d, 200));
  }

  Map<String, Object> task(String title) {
    return new HashMap<>(
        Map.of(
            "title",
            title,
            "description",
            "Work description",
            "type",
            "TASK",
            "priority",
            "HIGH",
            "status",
            "TODO"));
  }

  Map<String, Object> bug() {
    var d = task("Login fails");
    d.put("type", "BUG");
    d.put(
        "bug",
        Map.of(
            "severity",
            "CRITICAL",
            "steps",
            "Open login and submit",
            "expectedBehavior",
            "Signed in",
            "actualBehavior",
            "Error",
            "category",
            "OTHER"));
    return d;
  }

  Map<String, Object> map(JsonNode n) {
    return json.convertValue(
        n, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
  }

  void invite() throws Exception {
    long id =
        body(request(
                manager,
                "POST",
                "/api/projects/" + project + "/invitations",
                Map.of("email", developer.email),
                200))
            .path("id")
            .asLong();
    request(developer, "POST", "/api/invitations/" + id + "/respond", Map.of("accept", true), 200);
  }

  @BeforeEach
  void setup() throws Exception {
    when(remote.configured()).thenReturn(false);
    manager = account("Manager");
    developer = account("Developer");
    outsider = account("Outsider");
    project =
        body(request(
                manager,
                "POST",
                "/api/projects",
                Map.of("name", "Acceptance", "description", "Fixture", "timezone", "Asia/Kolkata"),
                200))
            .path("id")
            .asLong();
  }

  @Test
  void callSignalsAreScopedToCurrentParticipants() throws Exception {
    invite();
    String path = "/api/projects/" + project + "/call";
    Map<String, Object> media = Map.of("microphone", true, "video", "off");
    request(outsider, "GET", path, null, 403);
    request(outsider, "POST", path + "/join", media, 403);
    String managerSession =
        body(request(manager, "POST", path + "/join", media, 200)).path("session").asText();
    String peerSession =
        body(request(developer, "POST", path + "/join", media, 200)).path("session").asText();
    request(manager, "POST", path + "/join", media, 409);
    var signal =
        new HashMap<>(
            Map.of(
                "session",
                managerSession,
                "target",
                developer.id(),
                "targetSession",
                peerSession,
                "kind",
                "offer",
                "payload",
                Map.of("type", "offer", "sdp", "v=0")));
    request(developer, "POST", path + "/signal", signal, 400);
    request(outsider, "POST", path + "/signal", signal, 403);
    request(manager, "POST", path + "/signal", signal, 204);
    request(manager, "POST", path + "/sync", Map.of("session", peerSession, "media", media), 409);
    var received =
        body(
            request(
                developer,
                "POST",
                path + "/sync",
                Map.of("session", peerSession, "media", media),
                200));
    assertEquals(1, received.path("signals").size());
    assertEquals(manager.id(), received.path("signals").get(0).path("from").asLong());
    var ack =
        body(
            request(
                developer,
                "POST",
                path + "/sync",
                Map.of(
                    "session",
                    peerSession,
                    "media",
                    media,
                    "after",
                    received.path("signals").get(0).path("id").asLong()),
                200));
    assertEquals(0, ack.path("signals").size());
    request(
        manager, "DELETE", "/api/projects/" + project + "/members/" + developer.id(), null, 200);
    request(developer, "POST", path + "/sync", Map.of("session", peerSession, "media", media), 403);
    assertEquals(1, body(request(manager, "GET", path, null, 200)).path("participants").size());
    request(manager, "POST", path + "/leave", Map.of("session", managerSession), 204);
    assertEquals(0, body(request(manager, "GET", path, null, 200)).path("participants").size());
  }

  @Test
  void directCallsArePrivateAndSeparateFromProjectRooms() throws Exception {
    invite();
    long invitation =
        body(request(
                manager,
                "POST",
                "/api/projects/" + project + "/invitations",
                Map.of("email", outsider.email),
                200))
            .path("id")
            .asLong();
    request(
        outsider,
        "POST",
        "/api/invitations/" + invitation + "/respond",
        Map.of("accept", true),
        200);
    String projectCall = "/api/projects/" + project + "/call";
    String toDeveloper = "/api/direct-messages/" + developer.id + "/call";
    String toManager = "/api/direct-messages/" + manager.id + "/call";
    var media = Map.of("microphone", true, "video", "off");
    request(manager, "POST", projectCall + "/join", media, 200);
    var dial = body(request(manager, "POST", toDeveloper + "/join", media, 200));
    String starter = dial.path("session").asText();
    assertEquals(2, dial.path("lobby").path("capacity").asInt());
    assertEquals(
        1, body(request(developer, "GET", toManager, null, 200)).path("participants").size());
    assertTrue(body(request(outsider, "GET", toManager, null, 200)).path("participants").isEmpty());
    assertTrue(
        body(request(developer, "GET", "/api/direct-messages", null, 200))
            .toString()
            .contains("\"callActive\":true"));
    assertFalse(
        body(request(outsider, "GET", "/api/direct-messages", null, 200))
            .toString()
            .contains("\"callActive\":true"));
    request(outsider, "POST", toManager + "/sync", Map.of("session", starter, "media", media), 409);
    String peer =
        body(request(developer, "POST", toManager + "/join", media, 200)).path("session").asText();
    request(
        manager,
        "POST",
        toDeveloper + "/signal",
        Map.of(
            "session",
            starter,
            "target",
            outsider.id,
            "targetSession",
            peer,
            "kind",
            "offer",
            "payload",
            Map.of("type", "offer", "sdp", "v=0")),
        403);
    request(
        manager,
        "POST",
        toDeveloper + "/signal",
        Map.of(
            "session",
            starter,
            "target",
            developer.id,
            "targetSession",
            peer,
            "kind",
            "offer",
            "payload",
            Map.of("type", "offer", "sdp", "v=0")),
        204);
    var tick =
        body(
            request(
                developer,
                "POST",
                toManager + "/sync",
                Map.of("session", peer, "media", media),
                200));
    assertEquals(1, tick.path("signals").size());
    assertEquals(2, tick.path("lobby").path("participants").size());
    request(developer, "POST", toManager + "/leave", Map.of("session", peer), 204);
    request(
        manager, "POST", toDeveloper + "/sync", Map.of("session", starter, "media", media), 409);
    assertTrue(
        body(request(manager, "GET", toDeveloper, null, 200)).path("participants").isEmpty());
    assertEquals(
        1, body(request(manager, "GET", projectCall, null, 200)).path("participants").size());
    request(manager, "DELETE", "/api/projects/" + project + "/members/" + developer.id, null, 200);
    request(developer, "POST", toManager + "/join", media, 403);
  }

  @Test
  void snippetsStayProjectPrivateAndReviewLinksSurviveUpdates() throws Exception {
    invite();
    String path = "/api/projects/" + project + "/snippets";
    var snippet = Map.of("title", "Review query", "language", "SQL", "content", "SELECT 1;\n");
    var created = body(request(developer, "POST", path, snippet, 201));
    String itemPath = path + "/" + created.path("id").asLong();
    request(outsider, "GET", path, null, 403);
    request(manager, "PUT", itemPath, map(created), 403);
    var shared = body(request(manager, "GET", path + "?q=review", null, 200)).path("items").get(0);
    assertEquals("SELECT 1;\n", shared.path("content").asText());
    assertFalse(shared.path("canEdit").asBoolean());
    assertTrue(shared.path("canDelete").asBoolean());
    request(manager, "DELETE", itemPath, null, 204);
    assertEquals(0, body(request(developer, "GET", path, null, 200)).path("items").size());

    String workPath = "/api/projects/" + project + "/work-items";
    var task = task("Review form validation");
    task.put("reviewUrl", "javascript:alert(1)");
    request(manager, "POST", workPath, task, 400);
    task.put("reviewUrl", "https://github.com/example/portal/pull/42");
    var createdWork = create(manager, task);
    var edit = map(createdWork);
    edit.remove("reviewUrl");
    edit.put("status", "REVIEW");
    var reviewed =
        body(
            request(
                developer, "PUT", "/api/work-items/" + createdWork.path("id").asLong(), edit, 200));
    assertEquals(task.get("reviewUrl"), reviewed.path("reviewUrl").asText());
  }

  @Test
  void A01_accountsAndLogout() throws Exception {
    request(
        null,
        "POST",
        "/api/auth/register",
        Map.of(
            "name",
            "Duplicate",
            "email",
            manager.email.toUpperCase(Locale.ROOT),
            "password",
            "Testing123!"),
        409);
    assertEquals(
        manager.id, body(request(manager, "GET", "/api/auth/me", null, 200)).path("id").asLong());
    request(manager, "POST", "/api/auth/logout", Map.of(), 204);
    assertTrue(manager.session.isInvalid());
    request(null, "GET", "/api/projects", null, 401);
  }

  @Test
  void A02_invitationAcceptanceAndDecline() throws Exception {
    assertEquals(0, body(request(developer, "GET", "/api/projects", null, 200)).size());
    invite();
    var p = body(request(developer, "GET", "/api/projects", null, 200));
    assertEquals("DEVELOPER", p.get(0).path("role").asText());
    assertEquals(
        2,
        body(request(manager, "GET", "/api/projects/" + project + "/members", null, 200)).size());
    long id =
        body(request(
                manager,
                "POST",
                "/api/projects/" + project + "/invitations",
                Map.of("email", outsider.email),
                200))
            .path("id")
            .asLong();
    request(outsider, "POST", "/api/invitations/" + id + "/respond", Map.of("accept", false), 200);
    assertEquals(0, body(request(outsider, "GET", "/api/projects", null, 200)).size());
  }

  @Test
  void A03_projectIsolationAndManagerActions() throws Exception {
    invite();
    var w = create(manager, task("Private"));
    request(outsider, "GET", "/api/work-items/" + w.path("id").asLong(), null, 403);
    request(outsider, "GET", "/api/projects/" + project + "/dashboard", null, 403);
    request(developer, "PUT", "/api/projects/" + project, Map.of("name", "Stolen"), 403);
    request(developer, "DELETE", "/api/work-items/" + w.path("id").asLong(), null, 403);
    assertTrue(items.existsById(w.path("id").asLong()));
    String projectPath = "/api/projects/" + project;
    request(manager, "GET", projectPath + "/activity", null, 200);
    request(developer, "GET", projectPath + "/activity?page=1", null, 403);
    request(outsider, "GET", projectPath + "/activity", null, 403);
    request(developer, "GET", projectPath + "/invitations", null, 403);
    request(developer, "POST", projectPath + "/invitations", Map.of("email", outsider.email), 403);
    request(
        developer, "PUT", projectPath + "/members/" + developer.id, Map.of("role", "MANAGER"), 403);
    request(developer, "GET", projectPath + "/dashboard", null, 200);
    request(
        manager, "PUT", projectPath + "/members/" + developer.id, Map.of("role", "MANAGER"), 200);
    request(developer, "GET", projectPath + "/activity", null, 200);
    request(
        manager, "PUT", projectPath + "/members/" + developer.id, Map.of("role", "DEVELOPER"), 200);
    request(developer, "GET", projectPath + "/activity", null, 403);
  }

  @Test
  void A04_taskLifecycleAndActivity() throws Exception {
    invite();
    var d = task("Implement login");
    d.put("assigneeId", developer.id);
    var w = create(manager, d);
    long id = w.path("id").asLong();
    for (String status : List.of("IN_PROGRESS", "REVIEW", "DONE", "TODO")) {
      var update = map(w);
      update.put("status", status);
      w = body(request(developer, "PUT", "/api/work-items/" + id, update, 200));
      assertEquals(status, items.findById(id).orElseThrow().status);
    }
    assertTrue(
        body(request(manager, "GET", "/api/projects/" + project + "/activity", null, 200)).size()
            >= 6);
  }

  @Test
  void A05_bugFieldsAndTypeConsistency() throws Exception {
    var b = create(manager, bug());
    assertEquals("CRITICAL", b.path("bug").path("severity").asText());
    var d = map(b);
    d.put("status", "DONE");
    b = body(request(manager, "PUT", "/api/work-items/" + b.path("id").asLong(), d, 200));
    d = map(b);
    d.put("status", "TODO");
    var reopened =
        body(request(manager, "PUT", "/api/work-items/" + b.path("id").asLong(), d, 200));
    assertEquals("Open login and submit", reopened.path("bug").path("steps").asText());
  }

  @Test
  void A06_commentsNotificationsAndPrivateReadState() throws Exception {
    invite();
    var d = task("Discuss");
    d.put("assigneeId", developer.id);
    long id = create(manager, d).path("id").asLong();
    long comment =
        body(request(
                developer,
                "POST",
                "/api/work-items/" + id + "/comments",
                Map.of("content", "Please review"),
                200))
            .path("id")
            .asLong();
    request(outsider, "DELETE", "/api/comments/" + comment, null, 403);
    request(manager, "PUT", "/api/comments/" + comment, Map.of("content", "Not mine"), 403);
    var n = body(request(developer, "GET", "/api/notifications", null, 200));
    assertEquals(1, n.size());
    assertEquals(
        1,
        body(request(developer, "GET", "/api/notifications/unread-count", null, 200))
            .path("count")
            .asInt());
    long nid = n.get(0).path("id").asLong();
    request(outsider, "POST", "/api/notifications/" + nid + "/read", Map.of(), 403);
    request(developer, "POST", "/api/notifications/" + nid + "/read", Map.of(), 200);
    assertTrue(
        body(request(developer, "GET", "/api/notifications", null, 200))
            .get(0)
            .path("read")
            .asBoolean());
    assertEquals(1, body(request(manager, "GET", "/api/notifications", null, 200)).size());
  }

  @Test
  void A07_dashboardMetricsAndDeadlineBoundary() throws Exception {
    invite();
    assertEquals(
        0,
        body(request(manager, "GET", "/api/projects/" + project + "/dashboard", null, 200))
            .path("completion")
            .asInt());
    var d = task("Overdue");
    d.put("deadline", "2000-01-01");
    d.put("assigneeId", developer.id);
    create(manager, d);
    d = task("Complete");
    d.put("status", "DONE");
    d.put("deadline", "2000-01-01");
    create(manager, d);
    create(manager, bug());
    var metrics =
        body(request(manager, "GET", "/api/projects/" + project + "/dashboard", null, 200));
    assertEquals(3, metrics.path("total").asInt());
    assertEquals(2, metrics.path("tasks").asInt());
    assertEquals(1, metrics.path("bugs").asInt());
    assertEquals(1, metrics.path("overdue").asInt());
    assertEquals(100.0 / 3, metrics.path("completion").asDouble(), 0.001);
    assertEquals(1, metrics.path("severity").path("CRITICAL").asInt());
    var clock = Clock.fixed(Instant.parse("2026-11-24T20:00:00Z"), ZoneOffset.UTC);
    var w = new WorkItem();
    w.projectId = project;
    w.status = "TODO";
    w.deadline = LocalDate.of(2026, 11, 25);
    assertFalse(service.overdueAt(w, clock));
    w.deadline = LocalDate.of(2026, 11, 24);
    assertTrue(service.overdueAt(w, clock));
    w.status = "DONE";
    assertFalse(service.overdueAt(w, clock));
  }

  @Test
  void A08_filtersPaginationAndEmptyResults() throws Exception {
    create(manager, task("Alpha"));
    create(manager, task("Beta"));
    create(manager, bug());
    var r =
        body(
            request(
                manager,
                "GET",
                "/api/projects/" + project + "/work-items?type=TASK&size=1",
                null,
                200));
    assertEquals(2, r.path("total").asInt());
    assertEquals("Beta", r.path("items").get(0).path("title").asText());
    assertEquals(
        "Alpha",
        body(request(
                manager,
                "GET",
                "/api/projects/" + project + "/work-items?type=TASK&size=1&page=1",
                null,
                200))
            .path("items")
            .get(0)
            .path("title")
            .asText());
    assertEquals(
        0,
        body(request(
                manager, "GET", "/api/projects/" + project + "/work-items?q=missing", null, 200))
            .path("total")
            .asInt());
  }

  @Test
  void projectChatAndPortfolioRespectMembership() throws Exception {
    invite();
    String messages = "/api/projects/" + project + "/messages";
    var first =
        body(request(manager, "POST", messages, Map.of("content", "  Ready for review  "), 201));
    var reply =
        body(request(developer, "POST", messages, Map.of("content", "I will verify it."), 201));
    assertEquals("Ready for review", first.path("content").asText());
    assertEquals("MANAGER", first.path("authorRole").asText());
    assertEquals("Developer", reply.path("author").asText());
    assertEquals("DEVELOPER", reply.path("authorRole").asText());
    assertEquals(2, body(request(developer, "GET", messages, null, 200)).path("messages").size());
    var earlier =
        body(
            request(
                developer, "GET", messages + "?before=" + reply.path("id").asLong(), null, 200));
    assertEquals(first.path("id"), earlier.path("messages").get(0).path("id"));
    assertEquals("MANAGER", earlier.path("messages").get(0).path("authorRole").asText());
    request(outsider, "GET", messages, null, 403);
    request(outsider, "POST", messages, Map.of("content", "Private"), 403);
    request(developer, "POST", messages, Map.of("content", "   "), 400);

    long other =
        body(request(
                manager,
                "POST",
                "/api/projects",
                Map.of("name", "Separate", "description", "Fixture", "timezone", "Asia/Kolkata"),
                200))
            .path("id")
            .asLong();
    var otherMessages =
        body(request(manager, "GET", "/api/projects/" + other + "/messages", null, 200));
    assertTrue(otherMessages.path("messages").isEmpty());
    var t = task("Implement checkout");
    t.put("status", "IN_PROGRESS");
    create(manager, t);
    var b = bug();
    b.put("status", "IN_PROGRESS");
    create(manager, b);
    var portfolio = body(request(developer, "GET", "/api/portfolio", null, 200));
    assertEquals(1, portfolio.size());
    assertEquals(project, portfolio.get(0).path("id").asLong());
    assertEquals(1, portfolio.get(0).path("tasksInProgress").asInt());
    assertEquals(1, portfolio.get(0).path("bugsInProgress").asInt());
  }

  @Test
  void directMessagesStayBetweenParticipants() throws Exception {
    invite();
    var teammate = account("Teammate");
    long invitation =
        body(request(
                manager,
                "POST",
                "/api/projects/" + project + "/invitations",
                Map.of("email", teammate.email),
                200))
            .path("id")
            .asLong();
    request(
        teammate,
        "POST",
        "/api/invitations/" + invitation + "/respond",
        Map.of("accept", true),
        200);

    String direct = "/api/direct-messages";
    String toDeveloper = direct + "/" + developer.id;
    String toManager = direct + "/" + manager.id;
    var contact = body(request(developer, "GET", direct, null, 200));
    assertTrue(contact.toString().contains("Manager"));
    assertFalse(contact.toString().contains(manager.email));
    assertFalse(contact.toString().contains("Outsider"));
    var first =
        body(request(manager, "POST", toDeveloper, Map.of("content", "  Private handoff  "), 201));
    var second = body(request(developer, "POST", toManager, Map.of("content", "Received."), 201));
    assertEquals("Private handoff", first.path("content").asText());
    assertEquals(developer.id, second.path("authorId").asLong());
    var roles =
        body(request(developer, "GET", toManager + "?project=" + project, null, 200))
            .path("messages");
    assertEquals("MANAGER", roles.get(0).path("authorRole").asText());
    assertEquals("DEVELOPER", roles.get(1).path("authorRole").asText());
    var unshared =
        body(request(developer, "GET", toManager + "?project=99999999", null, 200))
            .path("messages");
    assertTrue(unshared.get(0).path("authorRole").isNull());
    assertEquals(2, body(request(developer, "GET", toManager, null, 200)).path("messages").size());
    assertEquals(
        first.path("id"),
        body(request(
                manager, "GET", toDeveloper + "?before=" + second.path("id").asLong(), null, 200))
            .path("messages")
            .get(0)
            .path("id"));
    assertEquals(
        "Received.",
        body(request(manager, "GET", direct, null, 200)).get(0).path("lastMessage").asText());

    assertTrue(body(request(teammate, "GET", toDeveloper, null, 200)).path("messages").isEmpty());
    assertFalse(
        body(request(teammate, "GET", direct, null, 200)).toString().contains("Private handoff"));
    assertTrue(
        body(request(manager, "GET", "/api/projects/" + project + "/messages", null, 200))
            .path("messages")
            .isEmpty());
    request(outsider, "GET", toDeveloper, null, 403);
    request(outsider, "POST", toDeveloper, Map.of("content", "Hello"), 403);
    request(manager, "POST", toManager, Map.of("content", "Hello"), 400);
    request(manager, "POST", toDeveloper, Map.of("content", "   "), 400);

    request(manager, "DELETE", "/api/projects/" + project + "/members/" + developer.id, null, 200);
    assertEquals(2, body(request(developer, "GET", toManager, null, 200)).path("messages").size());
    assertFalse(
        body(request(developer, "GET", direct, null, 200)).get(0).path("canSend").asBoolean());
    request(developer, "POST", toManager, Map.of("content", "New message"), 403);
  }

  @Test
  void A10_localInsightsAndExplicitAcceptance() throws Exception {
    var b = create(manager, bug());
    long id = b.path("id").asLong();
    var r = body(request(manager, "POST", "/api/work-items/" + id + "/ai/category", Map.of(), 200));
    assertEquals("AUTHENTICATION", r.path("category").asText());
    assertTrue(r.path("nextCheck").asText().contains("session"));
    assertEquals(
        "OTHER",
        body(request(manager, "GET", "/api/work-items/" + id, null, 200))
            .path("bug")
            .path("category")
            .asText());
    var s =
        body(request(manager, "POST", "/api/projects/" + project + "/ai/summary", Map.of(), 200));
    assertEquals("Local factual summary", s.path("provider").asText());
    assertEquals(1, s.path("facts").path("total").asInt());
    assertEquals(id, s.path("facts").path("attention").get(0).path("id").asLong());
    assertFalse(s.path("generatedAt").asText().isBlank());
    request(outsider, "POST", "/api/projects/" + project + "/ai/summary", Map.of(), 403);
  }

  @Test
  void A11_providerFailuresAndRequestLimit() throws Exception {
    when(remote.configured()).thenReturn(true);
    var b = create(manager, bug());
    long id = b.path("id").asLong();
    for (String failure : List.of("timeout", "malformed", "rate limit")) {
      doThrow(new IllegalStateException(failure)).when(remote).category(anyString());
      var r =
          body(request(manager, "POST", "/api/work-items/" + id + "/ai/category", Map.of(), 200));
      assertEquals("Local rule-based suggestion", r.path("provider").asText());
      assertTrue(r.has("notice"));
    }
    for (int i = 0; i < 7; i++)
      request(manager, "POST", "/api/work-items/" + id + "/ai/category", Map.of(), 200);
    request(manager, "POST", "/api/work-items/" + id + "/ai/category", Map.of(), 429);
    assertEquals(
        "OTHER",
        body(request(manager, "GET", "/api/work-items/" + id, null, 200))
            .path("bug")
            .path("category")
            .asText());
  }

  @Test
  void A12_membershipAssignmentAndConflict() throws Exception {
    invite();
    var d = task("Assignment");
    d.put("assigneeId", outsider.id);
    request(manager, "POST", "/api/projects/" + project + "/work-items", d, 400);
    d.put("assigneeId", developer.id);
    var w = create(manager, d);
    var old = map(w);
    var current = map(w);
    current.put("priority", "LOW");
    request(manager, "PUT", "/api/work-items/" + w.path("id").asLong(), current, 200);
    request(manager, "PUT", "/api/work-items/" + w.path("id").asLong(), old, 409);
    request(manager, "DELETE", "/api/projects/" + project + "/members/" + manager.id, null, 400);
    request(
        manager,
        "PUT",
        "/api/projects/" + project + "/members/" + manager.id,
        Map.of("role", "DEVELOPER"),
        400);
    request(manager, "DELETE", "/api/projects/" + project + "/members/" + developer.id, null, 200);
    assertNull(items.findById(w.path("id").asLong()).orElseThrow().assigneeId);
    request(developer, "GET", "/api/work-items/" + w.path("id").asLong(), null, 403);
  }

  @Test
  void A13_csrfAndValidation() throws Exception {
    var r =
        mvc.perform(
                post("/api/projects")
                    .session(manager.session)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"CSRF\"}"))
            .andReturn();
    assertEquals(403, r.getResponse().getStatus());
    request(
        manager,
        "POST",
        "/api/projects/" + project + "/work-items",
        Map.of("title", "Bad", "status", "ILLEGAL"),
        400);
    request(
        null,
        "POST",
        "/api/auth/register",
        Map.of("name", "", "email", "bad", "password", "x"),
        400);
  }
}
