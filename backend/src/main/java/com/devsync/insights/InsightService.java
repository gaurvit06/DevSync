package com.devsync.insights;

import com.devsync.projects.WorkspaceService;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class InsightService {
  private final WorkspaceService workspace;
  private final LocalAiProvider local;
  private final ApiAiProvider remote;
  private final Clock clock;
  private final Map<Long, Deque<Instant>> limits = new HashMap<>();

  public InsightService(WorkspaceService w, LocalAiProvider l, ApiAiProvider r, Clock c) {
    workspace = w;
    local = l;
    remote = r;
    clock = c;
  }

  private synchronized void limit(long actor) {
    var q = limits.computeIfAbsent(actor, k -> new ArrayDeque<>());
    Instant now = clock.instant();
    while (!q.isEmpty() && q.peek().isBefore(now.minusSeconds(60))) q.remove();
    if (q.size() >= 10)
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,
          "Wait a minute before another AI request");
    q.add(now);
  }

  public Object category(long actor, long id) {
    var w = workspace.accessItem(actor, id);
    WorkspaceService.require(w.type.equals("BUG"), "Only bugs have categories");
    limit(actor);
    String input = w.title + "\n" + w.description + "\n" + workspace.bugSteps(id);
    if (input.length() > 12000) input = input.substring(0, 12000);
    Map<String, Object> result;
    try {
      result = remote.configured() ? remote.category(input) : local.category(input);
    } catch (RuntimeException e) {
      result = new LinkedHashMap<>(local.category(input));
      result.put("notice", "AI unavailable; showing local fallback.");
    }
    var suggestion = new LinkedHashMap<>(result);
    suggestion.putIfAbsent("nextCheck", LocalAiProvider.nextCheck((String) result.get("category")));
    return suggestion;
  }

  public Object summary(long actor, long p) {
    var facts = workspace.summaryFacts(actor, p);
    limit(actor);
    Map<String, Object> result;
    try {
      result = remote.configured() ? remote.summary(facts) : local.summary(facts);
    } catch (RuntimeException e) {
      result = new LinkedHashMap<>(local.summary(facts));
      result.put("notice", "AI unavailable; showing local fallback.");
    }
    var out = new LinkedHashMap<>(result);
    out.put("generatedAt", clock.instant());
    out.put("facts", facts);
    return out;
  }
}
