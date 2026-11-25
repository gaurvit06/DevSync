import { api, ApiError } from "../api";

type VideoMode = "off" | "camera" | "screen";
type MediaState = { microphone: boolean; video: VideoMode };
type Participant = {
  userId: number;
  name: string;
  session: string;
  media: MediaState;
};

export type Lobby = {
  startedAt: string | null;
  participants: Participant[];
  capacity: number;
};

type Signal =
  | {
      id: number;
      from: number;
      fromSession: string;
      kind: "ice";
      payload: RTCIceCandidateInit;
    }
  | {
      id: number;
      from: number;
      fromSession: string;
      kind: "offer" | "answer";
      payload: RTCSessionDescriptionInit;
    };

type Joined = {
  session: string;
  lobby: Lobby;
  iceServers: {
    urls: string;
    username: string | null;
    credential: string | null;
  }[];
};

type Peer = {
  participant: Participant;
  connection: RTCPeerConnection;
  stream: MediaStream;
  pendingIce: RTCIceCandidateInit[];
  restarted: boolean;
  videoSender?: RTCRtpSender;
};

export type CallSnapshot = {
  lobby: Lobby;
  media: MediaState;
  preview: MediaStream | null;
  relayConfigured: boolean;
  peers: {
    userId: number;
    state: RTCPeerConnectionState;
    stream: MediaStream;
  }[];
};

export class CallSession {
  private readonly path: string;
  private session: string | null = null;
  private iceServers: RTCIceServer[] = [];
  private readonly peers = new Map<number, Peer>();
  private microphone?: MediaStreamTrack;
  private camera?: MediaStreamTrack;
  private screen?: MediaStreamTrack;
  private preview: MediaStream | null = null;
  private timer?: number;
  private cursor = 0;
  private failures = 0;
  private closed = false;
  private lobby: Lobby = { startedAt: null, participants: [], capacity: 4 };

  constructor(
    path: string,
    private readonly userId: number,
    private readonly onSnapshot: (result: CallSnapshot) => void,
    private readonly onError: (message: string) => void,
    private readonly onLost: (message: string) => void,
  ) {
    this.path = path;
  }

  async start(video: boolean) {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      throw new Error(
        "Calling requires a supported browser on HTTPS or localhost.",
      );
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video,
    });
    if (this.closed) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.microphone = stream.getAudioTracks()[0];
    this.camera = stream.getVideoTracks()[0];
    this.prepareCamera(this.camera);
    this.setPreview();
    try {
      const joined: Joined = await this.post("/join", this.media());
      if (this.closed) {
        await this.leave(joined.session);
        return;
      }
      this.session = joined.session;
      this.lobby = joined.lobby;
      this.iceServers = joined.iceServers.map(
        ({ urls, username, credential }) =>
          username && credential ? { urls, username, credential } : { urls },
      );
      this.publish();
      void this.sync();
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop() {
    if (this.closed) return;
    this.closed = true;
    window.clearTimeout(this.timer);
    for (const peer of this.peers.values()) peer.connection.close();
    this.peers.clear();
    for (const track of [this.microphone, this.camera, this.screen])
      track?.stop();
    this.preview = null;
    if (this.session) void this.leave(this.session);
  }

  toggleMicrophone() {
    if (!this.microphone) return;
    this.microphone.enabled = !this.microphone.enabled;
    this.publish();
  }

  async toggleCamera() {
    if (this.camera) {
      this.camera.stop();
      this.camera = undefined;
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (this.closed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.camera = stream.getVideoTracks()[0];
      this.prepareCamera(this.camera);
    }
    await this.updateVideo();
  }

  async toggleScreen() {
    if (this.screen) {
      this.screen.stop();
      this.screen = undefined;
      await this.updateVideo();
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("Screen sharing is unavailable in this browser.");
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    if (this.closed) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const track = stream.getVideoTracks()[0];
    this.screen = track;
    track.addEventListener(
      "ended",
      () => {
        if (this.screen !== track) return;
        this.screen = undefined;
        void this.updateVideo();
      },
      { once: true },
    );
    await this.updateVideo();
  }

  private prepareCamera(track?: MediaStreamTrack) {
    track?.addEventListener(
      "ended",
      () => {
        if (this.camera !== track) return;
        this.camera = undefined;
        void this.updateVideo();
      },
      { once: true },
    );
  }

  private setPreview() {
    const video = this.screen ?? this.camera;
    this.preview = video ? new MediaStream([video]) : null;
  }

  private async updateVideo() {
    if (this.closed) return;
    this.setPreview();
    const video = this.screen ?? this.camera ?? null;
    // Serialize device changes in the view and tolerate a peer leaving during replacement.
    await Promise.allSettled(
      [...this.peers.values()].map((peer) =>
        peer.videoSender?.replaceTrack(video),
      ),
    );
    this.publish();
  }

  private media(): MediaState {
    return {
      microphone:
        !!this.microphone?.enabled && this.microphone.readyState === "live",
      video: this.screen ? "screen" : this.camera ? "camera" : "off",
    };
  }

  private publish() {
    if (this.closed) return;
    this.onSnapshot({
      lobby: this.lobby,
      preview: this.preview,
      media: this.media(),
      relayConfigured: this.iceServers.some(
        ({ urls, username, credential }) =>
          typeof urls === "string" &&
          /^turns?:/i.test(urls) &&
          !!username &&
          !!credential,
      ),
      peers: [...this.peers.values()].map(
        ({ participant, connection, stream }) => ({
          userId: participant.userId,
          state: connection.connectionState,
          stream,
        }),
      ),
    });
  }

  private post(subpath: string, body: unknown, keepalive = false) {
    return api(this.path + subpath, {
      method: "POST",
      body: JSON.stringify(body),
      keepalive,
      signal: keepalive ? undefined : AbortSignal.timeout(8000),
    });
  }

  private async leave(session: string) {
    try {
      await this.post("/leave", { session }, true);
    } catch {
      // The server expires an abandoned call session if leaving cannot reach it.
    }
  }

  private async sync() {
    if (this.closed || !this.session) return;
    try {
      const reply: { lobby: Lobby; signals: Signal[] } = await this.post(
        "/sync",
        {
          session: this.session,
          after: this.cursor,
          media: this.media(),
        },
      );
      if (this.closed) return;
      this.failures = 0;
      this.lobby = reply.lobby;
      await this.syncPeers();
      for (const signal of reply.signals) {
        if (this.closed) return;
        this.cursor = signal.id;
        const peer = this.peers.get(signal.from);
        if (!peer || peer.participant.session !== signal.fromSession) continue;
        try {
          await this.receive(peer, signal);
        } catch {
          this.onError(
            `Cannot connect to ${peer.participant.name}. Ask them to rejoin the call.`,
          );
        }
      }
      await this.restartFailedConnections();
      this.publish();
    } catch (error) {
      if (this.closed) return;
      if (error instanceof ApiError && [401, 403, 409].includes(error.status)) {
        this.stop();
        this.onLost(error.message);
        return;
      }
      if (++this.failures >= 3) {
        this.stop();
        this.onLost("Connection to the call was lost. You can join again.");
        return;
      }
    }
    if (!this.closed)
      this.timer = window.setTimeout(() => void this.sync(), 700);
  }

  private async syncPeers() {
    const participants = this.lobby.participants.filter(
      (person) => person.userId !== this.userId,
    );
    for (const [id, peer] of this.peers) {
      if (
        !participants.some(
          (person) =>
            person.userId === id && person.session === peer.participant.session,
        )
      ) {
        peer.connection.close();
        this.peers.delete(id);
      }
    }
    for (const participant of participants) {
      if (this.closed || this.peers.has(participant.userId)) continue;
      const connection = new RTCPeerConnection({ iceServers: this.iceServers });
      const peer: Peer = {
        participant,
        connection,
        stream: new MediaStream(),
        pendingIce: [],
        restarted: false,
      };
      this.peers.set(participant.userId, peer);
      connection.onicecandidate = ({ candidate }) => {
        if (candidate && !this.closed) {
          void this.sendSignal(peer, "ice", candidate.toJSON()).catch(() => {
            if (!this.closed)
              this.onError(
                "A call connection could not exchange a network candidate.",
              );
          });
        }
      };
      connection.ontrack = ({ track }) => {
        peer.stream.addTrack(track);
        this.publish();
      };
      connection.onconnectionstatechange = () => {
        this.publish();
      };

      // One offerer per pair avoids simultaneous offers. Both media slots exist
      // from the start, so camera and screen switches do not require renegotiation.
      if (this.userId < participant.userId) {
        try {
          const audio = connection.addTransceiver("audio", {
            direction: "sendrecv",
          });
          peer.videoSender = connection.addTransceiver("video", {
            direction: "sendrecv",
          }).sender;
          await audio.sender.replaceTrack(this.microphone ?? null);
          await peer.videoSender.replaceTrack(
            this.screen ?? this.camera ?? null,
          );
          await connection.setLocalDescription(await connection.createOffer());
          await this.sendSignal(
            peer,
            "offer",
            connection.localDescription!.toJSON(),
          );
        } catch {
          if (!this.closed) {
            connection.close();
            this.peers.delete(participant.userId);
            this.onError(
              `Could not start a connection to ${participant.name}.`,
            );
          }
        }
      }
    }
  }

  private async restartFailedConnections() {
    for (const peer of this.peers.values()) {
      const { connection, participant } = peer;
      // The original offerer owns the restart to avoid simultaneous offers.
      if (
        this.closed ||
        this.userId >= participant.userId ||
        peer.restarted ||
        connection.iceConnectionState !== "failed" ||
        connection.signalingState !== "stable"
      )
        continue;
      peer.restarted = true;
      try {
        await connection.setLocalDescription(
          await connection.createOffer({ iceRestart: true }),
        );
        await this.sendSignal(
          peer,
          "offer",
          connection.localDescription!.toJSON(),
        );
      } catch {
        if (!this.closed)
          this.onError(`Could not reconnect to ${participant.name}.`);
      }
    }
  }

  private async addCandidate(peer: Peer, candidate: RTCIceCandidateInit) {
    try {
      await peer.connection.addIceCandidate(candidate);
    } catch (error) {
      // A stale or unusable candidate must not prevent the SDP answer.
      if (!(error instanceof DOMException && error.name === "OperationError"))
        throw error;
    }
  }

  private async receive(peer: Peer, signal: Signal) {
    const { connection } = peer;
    if (signal.kind === "ice") {
      if (connection.remoteDescription)
        await this.addCandidate(peer, signal.payload);
      else peer.pendingIce.push(signal.payload);
      return;
    }
    await connection.setRemoteDescription(signal.payload);
    for (const candidate of peer.pendingIce.splice(0))
      await this.addCandidate(peer, candidate);
    if (signal.kind === "offer") {
      for (const media of connection.getTransceivers()) {
        media.direction = "sendrecv";
        if (media.receiver.track.kind === "audio")
          await media.sender.replaceTrack(this.microphone ?? null);
        if (media.receiver.track.kind === "video") {
          peer.videoSender = media.sender;
          await media.sender.replaceTrack(this.screen ?? this.camera ?? null);
        }
      }
      await connection.setLocalDescription(await connection.createAnswer());
      await this.sendSignal(
        peer,
        "answer",
        connection.localDescription!.toJSON(),
      );
    }
  }

  private sendSignal(
    peer: Peer,
    kind: Signal["kind"],
    payload: RTCIceCandidateInit | RTCSessionDescriptionInit,
  ) {
    if (this.closed) return Promise.resolve();
    return this.post("/signal", {
      session: this.session,
      target: peer.participant.userId,
      targetSession: peer.participant.session,
      kind,
      payload,
    });
  }
}
