package com.devsync;

import static org.junit.jupiter.api.Assertions.*;

import com.devsync.insights.ApiAiProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ProviderTest {
  @Test
  void realAdapterValidatesResponsesWithoutLiveCredentials() throws Exception {
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    var mapper = new ObjectMapper();
    var output = new String[] {"{\"category\":\"UI\",\"explanation\":\"Layout issue\"}"};
    var status = new int[] {200};
    server.createContext(
        "/chat",
        e -> {
          e.getRequestBody().readAllBytes();
          var body =
              mapper
                  .writeValueAsString(
                      Map.of(
                          "choices",
                          new Object[] {Map.of("message", Map.of("content", output[0]))}))
                  .getBytes(StandardCharsets.UTF_8);
          e.sendResponseHeaders(status[0], body.length);
          try (var stream = e.getResponseBody()) {
            stream.write(body);
          }
        });
    server.start();
    try {
      var adapter =
          new ApiAiProvider(
              "test-only",
              "http://127.0.0.1:" + server.getAddress().getPort() + "/chat",
              "test",
              mapper);
      assertEquals("UI", adapter.category("Button layout").get("category"));
      output[0] = "{\"category\":\"INVALID\",\"explanation\":\"bad\"}";
      assertThrows(IllegalStateException.class, () -> adapter.category("x"));
      output[0] = "broken-json";
      assertThrows(IllegalStateException.class, () -> adapter.category("x"));
      status[0] = 429;
      assertThrows(IllegalStateException.class, () -> adapter.category("x"));
      status[0] = 200;
      output[0] = "{\"summary\":\"Two tasks remain.\"}";
      assertEquals("Two tasks remain.", adapter.summary(Map.of("total", 2)).get("summary"));
    } finally {
      server.stop(0);
    }
  }
}
