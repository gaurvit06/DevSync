import { LockKeyhole, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./api";
import CallRoom from "./calls/CallRoom";
import ChatConversation from "./ChatConversation";

type Contact = {
  id: number;
  name: string;
  canSend: boolean;
  callActive: boolean;
  lastMessage: string | null;
  lastMessageAt: string | null;
};

export default function DirectChat({
  userId,
  visible,
  projectId,
  projectName,
  activePath,
  onSessionChange,
  openDirectChat,
}: {
  userId: number;
  visible: boolean;
  projectId: number;
  projectName: string;
  activePath: string | null;
  onSessionChange: (path: string, active: boolean) => void;
  openDirectChat: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [recipientId, setRecipientId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let timer: number;
    async function refresh() {
      try {
        const next: Contact[] = await api("/direct-messages", {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(8000),
          ]),
        });
        if (controller.signal.aborted) return;
        setContacts(next);
        setError(false);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
      if (!controller.signal.aborted)
        timer = window.setTimeout(() => void refresh(), 3000);
    }
    void refresh();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [visible]);

  const recipient = contacts?.find((contact) => contact.id === recipientId);
  const callPath = (contact: Contact) => `/direct-messages/${contact.id}/call`;
  const onCallWith = contacts?.find(
    (contact) => callPath(contact) === activePath,
  );
  const callContact = onCallWith ?? recipient;
  const search = query.trim().toLocaleLowerCase();
  const results = contacts?.filter((contact) =>
    contact.name.toLocaleLowerCase().includes(search),
  );

  return (
    <div className={visible ? "direct-chat" : undefined}>
      {visible && (
        <section
          className="panel direct-contacts"
          aria-labelledby="direct-heading"
        >
          <h2 id="direct-heading">Direct messages</h2>
          <label className="direct-search">
            <Search size={17} aria-hidden="true" />
            <input
              className="form-control"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Find a teammate"
              placeholder="Find a teammate"
            />
          </label>
          {error && (
            <p className="muted" role="status">
              Could not refresh conversations. Retrying…
            </p>
          )}
          {!error && contacts === null && (
            <p className="muted" role="status">
              Loading teammates…
            </p>
          )}
          {contacts?.length === 0 && (
            <p className="muted">
              Join a project with a teammate to start a direct message.
            </p>
          )}
          {!!contacts?.length && results?.length === 0 && (
            <p className="muted">No teammates match your search.</p>
          )}
          <ul className="direct-contact-list">
            {results?.map((contact) => (
              <li key={contact.id}>
                <button
                  type="button"
                  className="direct-contact"
                  onClick={() => setRecipientId(contact.id)}
                  aria-pressed={recipientId === contact.id}
                  aria-label={`Chat with ${contact.name}`}
                  aria-description={
                    contact.callActive ? "Call in progress" : undefined
                  }
                >
                  <span className="avatar" aria-hidden="true">
                    {contact.name[0]}
                  </span>
                  <span className="direct-contact-copy">
                    <strong>{contact.name}</strong>
                    {contact.callActive ? (
                      <small className="direct-call-status">
                        <span className="call-live-dot" aria-hidden="true" />{" "}
                        Call in progress
                      </small>
                    ) : (
                      contact.lastMessage && (
                        <small>{contact.lastMessage}</small>
                      )
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {recipient || onCallWith ? (
        <div className="direct-thread">
          {visible && recipient && (
            <h2>
              <LockKeyhole size={17} aria-hidden="true" /> {recipient.name}
            </h2>
          )}
          <div className="chat-with-call">
            {callContact &&
              (callContact.canSend || onCallWith) &&
              (visible || onCallWith) && (
                <CallRoom
                  key={callPath(callContact)}
                  path={callPath(callContact)}
                  userId={userId}
                  direct
                  visible={visible && recipient?.id === callContact.id}
                  activePath={activePath}
                  onSessionChange={onSessionChange}
                  openCallRoom={() => {
                    setRecipientId(callContact.id);
                    openDirectChat();
                  }}
                />
              )}
            {recipient && (
              <ChatConversation
                key={`messages-${recipient.id}-${projectId}`}
                path={`/direct-messages/${recipient.id}${projectId ? `?project=${projectId}` : ""}`}
                roleProject={projectName}
                userId={userId}
                visible={visible}
                direct
                canSend={recipient.canSend}
              />
            )}
          </div>
        </div>
      ) : (
        visible && (
          <div className="panel direct-empty">
            <LockKeyhole size={28} aria-hidden="true" />
            <p>Select a teammate to open a private conversation.</p>
          </div>
        )
      )}
    </div>
  );
}
