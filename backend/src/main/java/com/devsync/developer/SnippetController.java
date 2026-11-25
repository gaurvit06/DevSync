package com.devsync.developer;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{project}/snippets")
public class SnippetController {
  private final SnippetService snippets;

  public SnippetController(SnippetService snippets) {
    this.snippets = snippets;
  }

  @GetMapping
  SnippetService.SnippetPage list(
      Authentication auth,
      @PathVariable long project,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "0") int page) {
    return snippets.list(actor(auth), project, q, page);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  SnippetService.SnippetView create(
      Authentication auth,
      @PathVariable long project,
      @Valid @RequestBody SnippetService.Edit edit) {
    return snippets.save(actor(auth), project, null, edit);
  }

  @PutMapping("/{id}")
  SnippetService.SnippetView update(
      Authentication auth,
      @PathVariable long project,
      @PathVariable long id,
      @Valid @RequestBody SnippetService.Edit edit) {
    return snippets.save(actor(auth), project, id, edit);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(Authentication auth, @PathVariable long project, @PathVariable long id) {
    snippets.delete(actor(auth), project, id);
  }

  private long actor(Authentication auth) {
    return Long.parseLong(auth.getName());
  }
}
