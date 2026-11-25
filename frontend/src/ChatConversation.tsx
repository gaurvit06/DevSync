import { MessageCircle, Send } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { api, label, send } from "./api";

type Message = {
  id: number;
  authorId: number;
  author: string;
  authorRole: "MANAGER" | "DEVELOPER" | null;
  content: string;
  createdAt: string;
};
type MessagePage = { messages: Message[]; hasOlder: boolean };

function merge(old: Message[], incoming: Message[]) {
  const messages = new Map(old.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((a, b) => a.id - b.id);
}

export default function ChatConversation({
  path,
  userId,
  visible,
  direct = false,
  canSend = true,
  roleProject,
}: {
  path: string;
  userId: number;
  visible: boolean;
  direct?: boolean;
  canSend?: boolean;
  roleProject?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const followLatest = useRef(true);
  const restorePosition = useRef<{ height: number; top: number } | null>(null);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let timer: number;
    async function poll() {
      try {
        const next: MessagePage = await api(path, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(8000),
          ]),
        });
        if (controller.signal.aborted) return;
        if (!initialized.current) setHasOlder(next.hasOlder);
        initialized.current = true;
        setLoaded(true);
        setLoadError("");
        setMessages((old) => merge(old, next.messages));
      } catch {
        if (!controller.signal.aborted)
          setLoadError("Could not refresh chat. Retrying…");
      }
      if (!controller.signal.aborted)
        timer = window.setTimeout(() => void poll(), 2000);
    }
    void poll();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [path, visible]);

  useLayoutEffect(() => {
    const element = list.current;
    if (!element || !visible) return;
    if (restorePosition.current) {
      const previous = restorePosition.current;
      restorePosition.current = null;
      element.scrollTop = previous.top + element.scrollHeight - previous.height;
    } else if (followLatest.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, visible]);

  async function loadOlder() {
    if (!messages.length || loadingOlder) return;
    setLoadingOlder(true);
    setSendError("");
    try {
      const separator = path.includes("?") ? "&" : "?";
      const older: MessagePage = await api(
        `${path}${separator}before=${messages[0].id}`,
      );
      if (list.current) {
        restorePosition.current = {
          height: list.current.scrollHeight,
          top: list.current.scrollTop,
        };
      }
      setMessages((old) => merge(old, older.messages));
      setHasOlder(older.hasOlder);
    } catch {
      setSendError("Could not load earlier messages. Try again.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function post(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend || sending || !draft.trim()) return;
    const content = draft.trim();
    setSending(true);
    setSendError("");
    try {
      const message: Message = await send(path, { content });
      setDraft("");
      followLatest.current = true;
      setMessages((old) => merge(old, [message]));
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Could not send the message.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      className="panel project-chat"
      aria-label={direct ? "Direct messages" : "Project messages"}
      hidden={!visible}
    >
      {loadError && (
        <p className="chat-notice muted" role="status">
          {loadError}
        </p>
      )}
      <div
        className="chat-history"
        ref={list}
        tabIndex={0}
        aria-label="Chat history"
        onScroll={(event) => {
          const el = event.currentTarget;
          followLatest.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 90;
        }}
      >
        {hasOlder && (
          <button
            type="button"
            className="btn btn-light chat-older"
            onClick={() => void loadOlder()}
            disabled={loadingOlder}
          >
            {loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        )}
        {!loaded && !loadError && <p className="muted">Loading messages…</p>}
        {loaded && !messages.length && (
          <p className="chat-empty muted">
            <MessageCircle size={23} aria-hidden="true" />
            {direct
              ? "No messages in this conversation yet."
              : "No messages in this project yet."}
          </p>
        )}
        <div
          role="log"
          aria-label={direct ? "Private conversation" : "Project conversation"}
          aria-relevant="additions"
        >
          {messages.map((message) => (
            <article
              key={message.id}
              className={`chat-message ${message.authorId === userId ? "is-mine" : ""}`}
            >
              <span className="avatar" aria-hidden="true">
                {message.author[0]}
              </span>
              <div>
                <header>
                  <strong>{message.author}</strong>
                  {message.authorRole && (
                    <span
                      className={`chat-role ${message.authorRole === "MANAGER" ? "chat-role-manager" : ""}`}
                      title={roleProject ? `Role in ${roleProject}` : undefined}
                    >
                      {label(message.authorRole)}
                    </span>
                  )}
                  <time dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </header>
                <p>{message.content}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
      {canSend ? (
        <form className="chat-compose" onSubmit={post}>
          {sendError && (
            <p className="alert alert-danger" role="alert">
              {sendError}
            </p>
          )}
          <div>
            <textarea
              aria-label={direct ? "Direct message" : "Project message"}
              placeholder={
                direct ? "Write a private message" : "Message the project team"
              }
              className="form-control"
              value={draft}
              maxLength={4000}
              rows={2}
              disabled={sending}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              className="btn btn-primary"
              disabled={sending || !draft.trim()}
            >
              <Send size={16} aria-hidden="true" />{" "}
              {sending ? "Sending…" : "Send message"}
            </button>
          </div>
        </form>
      ) : (
        <p className="chat-compose muted">
          You can send new messages when you share a project with this teammate.
        </p>
      )}
    </section>
  );
}
