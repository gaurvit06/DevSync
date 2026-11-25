package com.devsync.calls;

import com.devsync.identity.UserRepository;
import com.devsync.projects.ProjectMemberRepository;
import com.devsync.projects.WorkspaceService;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CallService {
  private static final int GROUP_CAPACITY = 4;
  private static final int MAX_PENDING_SIGNALS = 256;
  private static final Duration LEASE = Duration.ofSeconds(45);

  private final ProjectMemberRepository members;
  private final UserRepository users;
  private final Clock clock;
  private final List<IceServer> iceServers;
  private final Map<RoomKey, Room> rooms = new HashMap<>();

  record RoomKey(long first, long second) {
    static RoomKey project(long project) {
      return new RoomKey(project, 0);
    }

    static RoomKey direct(long actor, long recipient) {
      WorkspaceService.require(recipient > 0 && actor != recipient, "Choose another teammate.");
      return new RoomKey(Math.min(actor, recipient), Math.max(actor, recipient));
    }

    boolean direct() {
      return second != 0;
    }

    int capacity() {
      return direct() ? 2 : GROUP_CAPACITY;
    }
  }

  public CallService(
      ProjectMemberRepository members,
      UserRepository users,
      Clock clock,
      @Value("${CALL_ICE_URLS:}") String iceUrls,
      @Value("${CALL_TURN_USERNAME:}") String turnUsername,
      @Value("${CALL_TURN_CREDENTIAL:}") String turnCredential) {
    this.members = members;
    this.users = users;
    this.clock = clock;
    this.iceServers =
        Arrays.stream(iceUrls.split(","))
            .map(String::trim)
            .filter(url -> !url.isBlank())
            .map(
                url ->
                    url.startsWith("turn:") || url.startsWith("turns:")
                        ? new IceServer(url, turnUsername, turnCredential)
                        : new IceServer(url, null, null))
            .toList();
  }

  public record IceServer(String urls, String username, String credential) {}

  public record Media(boolean microphone, String video) {}

  public record Participant(
      long userId, String name, UUID session, Media media, Instant joinedAt) {}

  public record Lobby(Instant startedAt, List<Participant> participants, int capacity) {}

  public record Joined(UUID session, Lobby lobby, List<IceServer> iceServers) {}

  public record Signal(long id, long from, UUID fromSession, String kind, JsonNode payload) {}

  public record Update(Lobby lobby, List<Signal> signals) {}

  private static final class Presence {
    private Participant view;
    private Instant seenAt;
    private final ArrayDeque<Signal> inbox = new ArrayDeque<>();

    Presence(Participant view) {
      this.view = view;
      this.seenAt = view.joinedAt();
    }
  }

  private static final class Room {
    private final Instant startedAt;
    private long nextSignal = 1;
    private final Map<Long, Presence> participants = new LinkedHashMap<>();

    Room(Instant startedAt) {
      this.startedAt = startedAt;
    }
  }

  public Set<Long> activeDirectPeers(long actor) {
    synchronized (rooms) {
      expireRooms();
      return rooms.keySet().stream()
          .filter(key -> key.direct() && (key.first() == actor || key.second() == actor))
          .map(key -> key.first() == actor ? key.second() : key.first())
          .collect(Collectors.toSet());
    }
  }

  Lobby lobby(RoomKey key, long actor) {
    Set<Long> allowed = allowed(key, actor);
    synchronized (rooms) {
      return view(current(key, allowed), key.capacity());
    }
  }

  Joined join(RoomKey key, long actor, Media media) {
    Set<Long> allowed = allowed(key, actor);
    String name = users.findById(actor).orElseThrow().name;
    validate(media);
    synchronized (rooms) {
      Room room = current(key, allowed);
      if (room == null) {
        room = new Room(clock.instant());
        rooms.put(key, room);
      }
      if (room.participants.containsKey(actor)) {
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "You are already in this call in another tab.");
      }
      if (room.participants.size() >= key.capacity()) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "This call is full.");
      }
      UUID session = UUID.randomUUID();
      room.participants.put(
          actor, new Presence(new Participant(actor, name, session, media, clock.instant())));
      return new Joined(session, view(room, key.capacity()), iceServers);
    }
  }

  Update sync(RoomKey key, long actor, UUID session, long after, Media media) {
    Set<Long> allowed = allowed(key, actor);
    validate(media);
    WorkspaceService.require(after >= 0, "Invalid call cursor");
    synchronized (rooms) {
      Room room = current(key, allowed);
      Presence presence = requirePresence(room, actor, session);
      Participant previous = presence.view;
      presence.view = new Participant(actor, previous.name(), session, media, previous.joinedAt());
      presence.seenAt = clock.instant();
      presence.inbox.removeIf(signal -> signal.id() <= after);
      return new Update(view(room, key.capacity()), List.copyOf(presence.inbox));
    }
  }

  void signal(
      RoomKey key,
      long actor,
      UUID session,
      long target,
      UUID targetSession,
      String kind,
      JsonNode payload) {
    Set<Long> allowed = allowed(key, actor);
    WorkspaceService.require(actor != target, "Choose another call participant.");
    if (key.direct() && !allowed.contains(target)) WorkspaceService.denied();
    WorkspaceService.require(
        payload != null
            && payload.isObject()
            && payload.toString().length() <= 32768
            && validSignal(kind, payload),
        "Invalid call signal.");
    synchronized (rooms) {
      Room room = current(key, allowed);
      requirePresence(room, actor, session);
      Presence recipient = room.participants.get(target);
      // A queued candidate can arrive after its peer has already left or rejoined.
      if (recipient == null || !recipient.view.session().equals(targetSession)) return;
      if (recipient.inbox.size() >= MAX_PENDING_SIGNALS) {
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Call signaling is busy.");
      }
      recipient.inbox.add(new Signal(room.nextSignal++, actor, session, kind, payload.deepCopy()));
    }
  }

  void leave(RoomKey key, long actor, UUID session) {
    synchronized (rooms) {
      Room room = rooms.get(key);
      if (room == null) return;
      Presence presence = room.participants.get(actor);
      if (presence != null && presence.view.session().equals(session)) {
        room.participants.remove(actor);
        if (key.direct() || room.participants.isEmpty()) rooms.remove(key);
      }
    }
  }

  private Set<Long> allowed(RoomKey key, long actor) {
    if (key.direct()) {
      if ((key.first() != actor && key.second() != actor)
          || !members.sharesProject(key.first(), key.second())) {
        synchronized (rooms) {
          rooms.remove(key);
        }
        WorkspaceService.denied();
      }
      return Set.of(key.first(), key.second());
    }
    Set<Long> allowed =
        members.findByProjectId(key.first()).stream()
            .map(row -> row.userId)
            .collect(Collectors.toSet());
    if (!allowed.contains(actor)) WorkspaceService.denied();
    return allowed;
  }

  private void expireRooms() {
    Instant expired = clock.instant().minus(LEASE);
    rooms
        .entrySet()
        .removeIf(
            entry -> {
              var participants = entry.getValue().participants;
              boolean expiredParticipant =
                  participants.values().removeIf(p -> p.seenAt.isBefore(expired));
              return participants.isEmpty() || entry.getKey().direct() && expiredParticipant;
            });
  }

  private Room current(RoomKey key, Set<Long> allowed) {
    expireRooms();
    Room room = rooms.get(key);
    if (room != null) room.participants.keySet().retainAll(allowed);
    if (room != null && room.participants.isEmpty()) rooms.remove(key);
    return rooms.get(key);
  }

  private Lobby view(Room room, int capacity) {
    return room == null
        ? new Lobby(null, List.of(), capacity)
        : new Lobby(
            room.startedAt,
            room.participants.values().stream().map(p -> p.view).toList(),
            capacity);
  }

  private Presence requirePresence(Room room, long actor, UUID session) {
    Presence presence = room == null ? null : room.participants.get(actor);
    if (presence == null || !presence.view.session().equals(session)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Your call session ended. Join again.");
    }
    return presence;
  }

  private boolean validSignal(String kind, JsonNode payload) {
    if ("ice".equals(kind)) return payload.path("candidate").isTextual();
    return ("offer".equals(kind) || "answer".equals(kind))
        && kind.equals(payload.path("type").asText())
        && payload.path("sdp").isTextual();
  }

  private void validate(Media media) {
    WorkspaceService.require(
        media != null
            && media.video() != null
            && Set.of("off", "camera", "screen").contains(media.video()),
        "Invalid media state.");
  }
}
