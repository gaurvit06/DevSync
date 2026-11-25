package com.devsync.chat;

import static com.devsync.chat.ChatMessages.PAGE_SIZE;

import com.devsync.calls.CallService;
import com.devsync.chat.ChatMessages.*;
import com.devsync.identity.UserRepository;
import com.devsync.projects.ProjectMemberRepository;
import com.devsync.projects.WorkspaceService;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class DirectChatService {
  private final DirectMessageRepository messages;
  private final ProjectMemberRepository members;
  private final UserRepository users;
  private final CallService calls;

  DirectChatService(
      DirectMessageRepository messages,
      ProjectMemberRepository members,
      UserRepository users,
      CallService calls) {
    this.messages = messages;
    this.members = members;
    this.users = users;
    this.calls = calls;
  }

  record Contact(
      long id,
      String name,
      boolean canSend,
      boolean callActive,
      String lastMessage,
      Instant lastMessageAt) {}

  @Transactional(readOnly = true)
  List<Contact> contacts(long actor) {
    var teammates = new HashSet<>(members.findTeammateIds(actor));
    var activeCalls = calls.activeDirectPeers(actor);
    var recent = new HashMap<Long, DirectMessage>();
    for (var message : messages.findAllById(messages.latestMessageIds(actor))) {
      recent.put(message.otherParticipant(actor), message);
    }
    var ids = new HashSet<>(teammates);
    ids.addAll(recent.keySet());
    return users.findAllById(ids).stream()
        .map(
            user -> {
              var last = recent.get(user.id);
              return new Contact(
                  user.id,
                  user.name,
                  teammates.contains(user.id),
                  teammates.contains(user.id) && activeCalls.contains(user.id),
                  last == null ? null : preview(last.content),
                  last == null ? null : last.createdAt);
            })
        .sorted(
            Comparator.comparing(
                    Contact::lastMessageAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(Contact::name, String.CASE_INSENSITIVE_ORDER)
                .thenComparingLong(Contact::id))
        .toList();
  }

  @Transactional(readOnly = true)
  MessagePage list(long actor, long recipient, Long before, Long project) {
    validateRecipient(actor, recipient);
    WorkspaceService.require(before == null || before > 0, "Invalid message cursor");
    long low = Math.min(actor, recipient);
    long high = Math.max(actor, recipient);
    if (!members.sharesProject(actor, recipient)
        && !messages.existsByUserLowIdAndUserHighId(low, high)) WorkspaceService.denied();
    var rows =
        messages.findByUserLowIdAndUserHighIdAndIdLessThanOrderByIdDesc(
            low, high, before == null ? Long.MAX_VALUE : before, PageRequest.of(0, PAGE_SIZE + 1));
    if (rows.isEmpty()) return new MessagePage(List.of(), false);

    var names = new HashMap<Long, String>();
    for (var user : users.findAllById(List.of(actor, recipient))) names.put(user.id, user.name);
    var roles = projectRoles(actor, recipient, project);
    return new MessagePage(
        rows.stream()
            .limit(PAGE_SIZE)
            .sorted(Comparator.comparing(row -> row.id))
            .map(row -> view(row, names.get(row.authorId), roles.get(row.authorId)))
            .toList(),
        rows.size() > PAGE_SIZE);
  }

  @Transactional
  MessageView post(long actor, long recipient, String content, Long project) {
    validateRecipient(actor, recipient);
    if (!members.sharesProject(actor, recipient)) WorkspaceService.denied();
    var author = users.findById(actor).orElseThrow();
    var message = new DirectMessage();
    message.userLowId = Math.min(actor, recipient);
    message.userHighId = Math.max(actor, recipient);
    message.authorId = actor;
    message.content = content.strip();
    WorkspaceService.require(!message.content.isBlank(), "Enter a message");
    return view(
        messages.save(message), author.name, projectRoles(actor, recipient, project).get(actor));
  }

  private Map<Long, String> projectRoles(long actor, long recipient, Long project) {
    if (project == null) return Map.of();
    var own = members.findByProjectIdAndUserId(project, actor);
    if (own.isEmpty()) return Map.of();
    return members
        .findByProjectIdAndUserId(project, recipient)
        .map(other -> Map.of(actor, own.get().role, recipient, other.role))
        .orElseGet(Map::of);
  }

  private static void validateRecipient(long actor, long recipient) {
    WorkspaceService.require(recipient > 0 && recipient != actor, "Choose another account");
  }

  private static String preview(String content) {
    int count = content.codePointCount(0, content.length());
    return count > 120 ? content.substring(0, content.offsetByCodePoints(0, 120)) + "…" : content;
  }

  private static MessageView view(DirectMessage row, String name, String role) {
    return new MessageView(row.id, row.authorId, name, role, row.content, row.createdAt);
  }
}
