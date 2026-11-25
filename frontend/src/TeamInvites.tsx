import { useEffect, useState, type FormEvent } from "react";
import { api, send } from "./api";

type PendingInvite = { id: number; name: string; email: string };

export default function TeamInvites({ projectId }: { projectId: number }) {
  const path = `/projects/${projectId}/invitations`;
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<PendingInvite[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [sending, setSending] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api(path, { signal: controller.signal })
      .then(setPending)
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [path, revision]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipient = email.trim();
    setSending(true);
    setError("");
    setConfirmation("");
    try {
      await send(path, { email: recipient });
      setEmail("");
      setConfirmation(
        `Invite sent to ${recipient}. They can accept it in their DevSync Inbox.`,
      );
      setRevision((previous) => previous + 1);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Invitation request failed.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="team-invites" aria-labelledby="invite-heading">
      <h3 id="invite-heading">Invite a teammate</h3>
      <p className="muted">
        Enter the email on their DevSync account. The invite appears in their
        Inbox here in DevSync.
      </p>
      <form className="invite-form" onSubmit={invite}>
        <input
          aria-label="Invite email"
          type="email"
          className="form-control"
          placeholder="teammate@example.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button className="btn btn-primary" disabled={sending}>
          {sending ? "Sending…" : "Send invitation"}
        </button>
      </form>
      {confirmation && (
        <p className="alert alert-success" role="status">
          {confirmation}
        </p>
      )}
      {error && (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      )}
      {pending && pending.length > 0 && (
        <>
          <h3>Pending invitations</h3>
          <ul className="list-unstyled mb-0">
            {pending.map((invite) => (
              <li key={invite.id} className="person-row">
                <span>
                  <strong>{invite.name}</strong>
                  <br />
                  <small>{invite.email}</small>
                </span>
                <span className="badge-soft">Awaiting response</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
