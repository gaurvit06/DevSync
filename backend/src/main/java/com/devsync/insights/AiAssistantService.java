package com.devsync.insights;

import java.util.Map;

public interface AiAssistantService {
  Map<String, Object> category(String input);

  Map<String, Object> summary(Map<String, Object> facts);
}
