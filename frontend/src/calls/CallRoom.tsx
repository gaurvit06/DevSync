import {
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { CallSession, type CallSnapshot, type Lobby } from "./CallSession";

function VideoTile({
  name,
  stream,
  mute,
  hideVideo,
  status,
  state,
}: {
  name: string;
  stream?: MediaStream | null;
  mute: boolean;
  hideVideo: boolean;
  status: string;
  state?: RTCPeerConnectionState;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = stream ?? null;
    return () => {
      element.srcObject = null;
    };
  }, [stream]);

  return (
    <figure className="call-tile" data-connection={state} aria-label={name}>
      <div className="call-tile-visual">
        <video
          ref={video}
          autoPlay
          playsInline
          muted={mute}
          className={hideVideo ? "audio-only" : undefined}
          onLoadedMetadata={() => {
            const element = video.current;
            if (element)
              void element.play().catch(() => {
                if (element.srcObject === stream && !mute) setBlocked(true);
              });
          }}
        />
        {hideVideo && (
          <span className="call-monogram" aria-hidden="true">
            {name[0]}
          </span>
        )}
        {blocked && stream && (
          <button
            type="button"
            className="btn btn-light call-audio"
            onClick={() =>
              void video.current
                ?.play()
                .then(() => setBlocked(false))
                .catch(() => {})
            }
          >
            Enable call audio
          </button>
        )}
      </div>
      <figcaption>
        <strong>{name}</strong>
        <span>{status}</span>
      </figcaption>
    </figure>
  );
}

function mediaError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError")
      return "Microphone, camera, or screen permission was declined.";
    if (error.name === "NotFoundError")
      return "A requested device was unavailable. Try voice only or connect a device.";
    if (error.name === "NotReadableError")
      return "A requested device is busy or unavailable.";
  }
  return error instanceof Error ? error.message : "Could not start the call.";
}

export default function CallRoom({
  path,
  userId,
  visible,
  direct = false,
  activePath,
  onSessionChange,
  openCallRoom,
  onLiveChange,
}: {
  path: string;
  userId: number;
  visible: boolean;
  direct?: boolean;
  activePath: string | null;
  onSessionChange: (path: string, active: boolean) => void;
  openCallRoom: () => void;
  onLiveChange?: (live: boolean) => void;
}) {
  const session = useRef<CallSession | null>(null);
  const [snapshot, setSnapshot] = useState<CallSnapshot | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lobbyRefresh, setLobbyRefresh] = useState(0);
  const inCall = snapshot !== null;

  useEffect(() => {
    if (inCall || (direct && !visible)) return;
    const controller = new AbortController();
    let timer: number;
    async function poll() {
      try {
        const next: Lobby = await api(path, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(6000),
          ]),
        });
        if (controller.signal.aborted) return;
        setLobby(next);
        onLiveChange?.(next.participants.length > 0);
        setError((old) =>
          old === "Could not load call availability." ? "" : old,
        );
      } catch {
        if (!controller.signal.aborted && visible)
          setError("Could not load call availability.");
      }
      if (!controller.signal.aborted)
        timer = window.setTimeout(() => void poll(), visible ? 1800 : 5000);
    }
    void poll();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [path, visible, direct, inCall, lobbyRefresh, onLiveChange]);

  useEffect(() => {
    function close() {
      session.current?.stop();
      session.current = null;
      onSessionChange(path, false);
    }
    window.addEventListener("pagehide", close);
    return () => {
      window.removeEventListener("pagehide", close);
      close();
    };
  }, [path, onSessionChange]);

  async function join(video: boolean) {
    if (session.current || (activePath && activePath !== path)) return;
    setBusy(true);
    setError("");
    onSessionChange(path, true);
    const connection = new CallSession(
      path,
      userId,
      (state) => {
        setSnapshot(state);
        onLiveChange?.(true);
      },
      setError,
      (message) => {
        session.current = null;
        setSnapshot(null);
        setLobby(null);
        setError(message);
        onSessionChange(path, false);
      },
    );
    session.current = connection;
    try {
      await connection.start(video);
    } catch (error) {
      if (session.current === connection) {
        connection.stop();
        session.current = null;
        setError(mediaError(error));
        onSessionChange(path, false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function changeDevice(action: () => Promise<void> | void) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(mediaError(error));
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    session.current?.stop();
    session.current = null;
    setSnapshot(null);
    setLobby(null);
    setError("");
    onSessionChange(path, false);
    setLobbyRefresh((old) => old + 1);
  }

  const media = snapshot?.media;
  const participants = (snapshot?.lobby ?? lobby)?.participants ?? [];
  const capacity = (snapshot?.lobby ?? lobby)?.capacity ?? (direct ? 2 : 4);
  const alreadyJoined =
    !inCall && participants.some((person) => person.userId === userId);
  const otherCall = activePath !== null && activePath !== path;
  const callDisabled =
    busy ||
    otherCall ||
    !lobby ||
    alreadyJoined ||
    participants.length >= capacity;
  const title = direct ? "Direct call" : "Group call";

  return (
    <>
      {!visible && (inCall || (!direct && participants.length > 0)) && (
        <button
          type="button"
          className="btn btn-outline-primary call-banner"
          onClick={openCallRoom}
        >
          <Phone size={16} aria-hidden="true" />{" "}
          {inCall
            ? direct
              ? "Return to direct call"
              : "Return to call"
            : "Project call in progress"}
        </button>
      )}
      <section
        className={`panel call-room ${inCall ? "call-room-live" : "call-room-lobby"}`}
        hidden={!visible}
        aria-label={title}
      >
        <div className="call-room-heading">
          <div>
            <h2>{title}</h2>
            <p className="muted" role="status">
              {participants.length
                ? direct && !inCall && !alreadyJoined
                  ? `Incoming call from ${participants[0].name}`
                  : `${participants.length} of ${capacity} participants`
                : lobby
                  ? "No call in progress"
                  : "Checking call availability…"}
            </p>
          </div>
          {inCall && (
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={leave}
            >
              <PhoneOff size={17} aria-hidden="true" /> Leave call
            </button>
          )}
        </div>
        {error && (
          <p className="alert alert-danger" role="alert">
            {error}
          </p>
        )}
        {snapshot?.peers.some(({ state }) => state === "failed") && (
          <p className="alert alert-warning" role="status">
            {snapshot.relayConfigured
              ? "A media connection failed. Leave and rejoin the call to try again."
              : "A media connection failed. This deployment needs a TURN relay for networks that block direct calls."}
          </p>
        )}
        {!snapshot || !media ? (
          <>
            {!!participants.length && (
              <ul className="call-roster list-inline">
                {participants.map((person) => (
                  <li key={person.session}>{person.name}</li>
                ))}
              </ul>
            )}
            <div className="call-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={callDisabled}
                onClick={() => void join(false)}
              >
                <Phone size={17} aria-hidden="true" />{" "}
                {participants.length ? "Join with voice" : "Start voice call"}
              </button>
              <button
                type="button"
                className="btn btn-outline-primary"
                disabled={callDisabled}
                onClick={() => void join(true)}
              >
                <Video size={17} aria-hidden="true" />{" "}
                {participants.length ? "Join with video" : "Start video call"}
              </button>
            </div>
            {alreadyJoined && (
              <p className="muted mt-3">You’re in this call in another tab.</p>
            )}
            {otherCall && (
              <p className="muted call-blocked">
                Leave your current call to join this one.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="call-grid">
              <VideoTile
                name="You"
                stream={snapshot.preview}
                mute
                hideVideo={media.video === "off"}
                status={
                  media.video === "screen"
                    ? "Sharing screen"
                    : media.microphone
                      ? "Microphone on"
                      : "Muted"
                }
              />
              {participants
                .filter((person) => person.userId !== userId)
                .map((person) => {
                  const peer = snapshot.peers.find(
                    (connection) => connection.userId === person.userId,
                  );
                  const state = peer?.state ?? "connecting";
                  const status =
                    state === "connected"
                      ? person.media.video === "screen"
                        ? "Sharing screen"
                        : person.media.microphone
                          ? "Connected"
                          : "Muted"
                      : state === "failed"
                        ? "Connection failed"
                        : state === "disconnected"
                          ? "Disconnected"
                          : "Connecting…";
                  return (
                    <VideoTile
                      key={person.session}
                      name={person.name}
                      stream={peer?.stream}
                      mute={false}
                      hideVideo={
                        state !== "connected" || person.media.video === "off"
                      }
                      status={status}
                      state={state}
                    />
                  );
                })}
            </div>
            <div className="call-actions">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => session.current?.toggleMicrophone()}
              >
                {media.microphone ? (
                  <MicOff size={18} aria-hidden="true" />
                ) : (
                  <Mic size={18} aria-hidden="true" />
                )}
                {media.microphone ? "Mute microphone" : "Unmute microphone"}
              </button>
              <button
                type="button"
                className="btn btn-light"
                disabled={busy || media.video === "screen"}
                onClick={() =>
                  void changeDevice(() => session.current?.toggleCamera())
                }
              >
                {media.video === "off" ? (
                  <Video size={18} aria-hidden="true" />
                ) : (
                  <VideoOff size={18} aria-hidden="true" />
                )}
                {media.video === "off" ? "Turn camera on" : "Turn camera off"}
              </button>
              <button
                type="button"
                className="btn btn-light"
                disabled={busy}
                onClick={() =>
                  void changeDevice(() => session.current?.toggleScreen())
                }
              >
                <MonitorUp size={18} aria-hidden="true" />{" "}
                {media.video === "screen" ? "Stop sharing" : "Share screen"}
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
