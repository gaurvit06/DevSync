package com.devsync.insights;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class InsightController {
  private final InsightService s;

  public InsightController(InsightService x) {
    s = x;
  }

  @PostMapping("/work-items/{id}/ai/category")
  Object category(Authentication a, @PathVariable long id) {
    return s.category(Long.parseLong(a.getName()), id);
  }

  @PostMapping("/projects/{p}/ai/summary")
  Object summary(Authentication a, @PathVariable long p) {
    return s.summary(Long.parseLong(a.getName()), p);
  }
}
