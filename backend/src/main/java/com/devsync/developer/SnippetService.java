package com.devsync.developer;

import com.devsync.identity.UserRepository;
import com.devsync.projects.WorkspaceService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class SnippetService {
  private static final Set<String> LANGUAGES =
      Set.of(
          "Bash",
          "CSS",
          "HTML",
          "Java",
          "JavaScript",
          "JSON",
          "Python",
          "SQL",
          "Text",
          "TypeScript",
          "YAML");
  private final WorkspaceService workspace;
  private final SnippetRepository snippets;
  private final UserRepository users;

  public SnippetService(
      WorkspaceService workspace, SnippetRepository snippets, UserRepository users) {
    this.workspace = workspace;
    this.snippets = snippets;
    this.users = users;
  }

  public record Edit(
      @NotBlank @Size(max = 100) String title,
      @NotBlank @Size(max = 24) String language,
      @NotBlank @Size(max = 10000) String content,
      Long version) {}

  public record SnippetView(
      long id,
      String title,
      String language,
      String content,
      String author,
      boolean canEdit,
      boolean canDelete,
      long version,
      Instant updatedAt) {}

  public record SnippetPage(List<SnippetView> items, boolean hasNext) {}

  private SnippetView view(Snippet snippet, long actor, boolean manager) {
    boolean owns = snippet.authorId == actor;
    return new SnippetView(
        snippet.id,
        snippet.title,
        snippet.language,
        snippet.content,
        workspace.found(users.findById(snippet.authorId)).name,
        owns,
        owns || manager,
        snippet.version,
        snippet.updatedAt);
  }

  public SnippetPage list(long actor, long project, String query, int page) {
    boolean manager = workspace.member(project, actor).role.equals("MANAGER");
    WorkspaceService.require(
        query.length() <= 100 && page >= 0 && page <= 10000, "Invalid snippet search");
    var result =
        snippets.findByProjectIdAndTitleContainingIgnoreCaseOrderByIdDesc(
            project, query.trim(), PageRequest.of(page, 12));
    return new SnippetPage(
        result.map(snippet -> view(snippet, actor, manager)).getContent(), result.hasNext());
  }

  public SnippetView save(long actor, long project, Long id, Edit edit) {
    boolean manager = workspace.member(project, actor).role.equals("MANAGER");
    WorkspaceService.require(LANGUAGES.contains(edit.language()), "Unsupported snippet language");
    Snippet snippet;
    if (id == null) {
      snippet = new Snippet();
      snippet.projectId = project;
      snippet.authorId = actor;
    } else {
      snippet = workspace.found(snippets.findByIdAndProjectId(id, project));
      if (snippet.authorId != actor) WorkspaceService.denied();
      if (!Objects.equals(snippet.version, edit.version())) {
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "This snippet changed. Reload before saving.");
      }
    }
    snippet.title = edit.title().trim();
    snippet.language = edit.language();
    snippet.content = edit.content();
    snippets.saveAndFlush(snippet);
    return view(snippet, actor, manager);
  }

  public void delete(long actor, long project, long id) {
    boolean manager = workspace.member(project, actor).role.equals("MANAGER");
    Snippet snippet = workspace.found(snippets.findByIdAndProjectId(id, project));
    if (snippet.authorId != actor && !manager) WorkspaceService.denied();
    snippets.delete(snippet);
  }
}
