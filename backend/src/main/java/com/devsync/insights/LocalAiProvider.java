package com.devsync.insights;

import java.util.*;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class LocalAiProvider implements AiAssistantService {
  private record Rule(String category, String nextCheck, List<String> terms) {}

  private static final List<Rule> RULES =
      List.of(
          new Rule(
              "AUTHENTICATION",
              "Reproduce with a fresh session and an expired session. Compare the sign-in response"
                  + " and redirect in both cases.",
              List.of(
                  "login",
                  "sign-in",
                  "sign in",
                  "password",
                  "session",
                  "token",
                  "unauthorized",
                  "permission",
                  "401",
                  "403")),
          new Rule(
              "DATABASE",
              "Check persisted data before and after reproduction. Compare the failing query or"
                  + " migration with a working case.",
              List.of(
                  "database",
                  "sql",
                  "migration",
                  "query",
                  "deadlock",
                  "foreign key",
                  "duplicate row")),
          new Rule(
              "PERFORMANCE",
              "Measure response time in a repeatable reproduction and identify which step takes the"
                  + " longest.",
              List.of(
                  "slow",
                  "latency",
                  "timeout",
                  "memory leak",
                  "unresponsive",
                  "slowdown",
                  "performance")),
          new Rule(
              "UI",
              "Reproduce at more than one viewport size and check whether the issue is limited to a"
                  + " particular browser.",
              List.of(
                  "layout",
                  "button",
                  "css",
                  "overlap",
                  "responsive",
                  "dropdown",
                  "clipped",
                  "viewport")),
          new Rule(
              "BACKEND",
              "Reproduce the failing request and compare its response status and server logs with a"
                  + " successful request.",
              List.of(
                  "api", "server", "endpoint", "http 500", "exception", "response", "payload")));

  public static String nextCheck(String category) {
    return RULES.stream()
        .filter(rule -> rule.category().equals(category))
        .findFirst()
        .map(Rule::nextCheck)
        .orElse(
            "Add the shortest reproduction you can, the expected result, and what happened instead"
                + " before assigning a category.");
  }

  @Override
  public Map<String, Object> category(String input) {
    String normalized = input.toLowerCase(Locale.ROOT);
    String title = normalized.lines().findFirst().orElse("");
    int bestScore = 0;
    boolean tied = false;
    Rule best = null;
    List<String> evidence = List.of();
    for (Rule rule : RULES) {
      var found = new ArrayList<String>();
      int score = 0;
      for (String term : rule.terms()) {
        var pattern =
            Pattern.compile("(?<![\\p{L}\\p{N}])" + Pattern.quote(term) + "(?![\\p{L}\\p{N}])");
        if (pattern.matcher(normalized).find()) {
          found.add(term);
          score += pattern.matcher(title).find() ? 3 : 1;
        }
      }
      if (score > bestScore) {
        best = rule;
        evidence = found;
        bestScore = score;
        tied = false;
      } else if (score > 0 && score == bestScore) {
        tied = true;
      }
    }
    String category = best == null || tied ? "OTHER" : best.category();
    String explanation =
        category.equals("OTHER")
            ? (tied
                ? "The report points to more than one category with similar evidence."
                : "The report does not yet give a clear signal for a specific category.")
            : "The report mentions "
                + evidence.stream()
                    .limit(3)
                    .map(term -> "“" + term + "”")
                    .collect(java.util.stream.Collectors.joining(", "))
                + ". Review these clues before saving the category.";
    return Map.of(
        "category",
        category,
        "explanation",
        explanation,
        "nextCheck",
        nextCheck(category),
        "provider",
        "Local rule-based suggestion");
  }

  @Override
  public Map<String, Object> summary(Map<String, Object> facts) {
    long total = ((Number) facts.get("total")).longValue();
    if (total == 0)
      return Map.of(
          "summary",
          "There are no work items in this project yet. Add or assign the first task to start"
              + " tracking progress.",
          "provider",
          "Local factual summary");
    Map<?, ?> statuses = (Map<?, ?>) facts.get("statuses");
    Map<?, ?> severity = (Map<?, ?>) facts.get("severity");
    long done = ((Number) statuses.get("DONE")).longValue();
    long active = ((Number) statuses.get("IN_PROGRESS")).longValue();
    long review = ((Number) statuses.get("REVIEW")).longValue();
    long overdue = ((Number) facts.get("overdue")).longValue();
    long openBugs =
        severity.values().stream().mapToLong(value -> ((Number) value).longValue()).sum();
    long percent = Math.round(100.0 * done / total);
    var progress =
        "%d of %d work items are complete (%d%%). %d in progress, %d in review."
            .formatted(done, total, percent, active, review);
    var attention =
        "%d overdue · %d open %s.".formatted(overdue, openBugs, openBugs == 1 ? "bug" : "bugs");
    return Map.of("summary", progress + " " + attention, "provider", "Local factual summary");
  }
}
