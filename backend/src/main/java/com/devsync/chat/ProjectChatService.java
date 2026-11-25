package com.devsync.chat;

import static com.devsync.chat.ChatMessages.PAGE_SIZE;

import com.devsync.chat.ChatMessages.*;
import com.devsync.identity.User;
import com.devsync.identity.UserRepository;
import com.devsync.projects.ProjectMemberRepository;
import com.devsync.projects.WorkspaceService;
import java.util.Comparator;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectChatService {
  private final WorkspaceService workspace;
  private final ProjectMessageRepository messages;
  private final UserRepository users;
  private final ProjectMemberRepository members;

  public ProjectChatService(
      WorkspaceService workspace,
      ProjectMessageRepository messages,
      UserRepository users,
      ProjectMemberRepository members) {
    this.workspace = workspace;
    this.messages = messages;
    this.users = users;
    this.members = members;
  }

  @Transactional(readOnly = true)
  public MessagePage list(long project, long actor, Long before) {
    workspace.member(project, actor);
    WorkspaceService.require(before == null || before > 0, "Invalid message cursor");
    var rows =
        messages.findByProjectIdAndIdLessThanOrderByIdDesc(
            project, before == null ? Long.MAX_VALUE : before, PageRequest.of(0, PAGE_SIZE + 1));
    var authors =
        users.findAllById(rows.stream().map(row -> row.authorId).distinct().toList()).stream()
            .collect(Collectors.toMap(user -> user.id, user -> user.name));
    var roles =
        members.findByProjectId(project).stream()
            .collect(Collectors.toMap(member -> member.userId, member -> member.role));
    return new MessagePage(
        rows.stream()
            .limit(PAGE_SIZE)
            .sorted(Comparator.comparing(row -> row.id))
            .map(row -> view(row, authors.get(row.authorId), roles.get(row.authorId)))
            .toList(),
        rows.size() > PAGE_SIZE);
  }

  @Transactional
  public MessageView post(long project, long actor, String content) {
    var membership = workspace.member(project, actor);
    var message = new ProjectMessage();
    message.projectId = project;
    message.authorId = actor;
    message.content = content.strip();
    User author = workspace.found(users.findById(actor));
    return view(messages.save(message), author.name, membership.role);
  }

  private MessageView view(ProjectMessage row, String name, String role) {
    return new MessageView(row.id, row.authorId, name, role, row.content, row.createdAt);
  }
}
