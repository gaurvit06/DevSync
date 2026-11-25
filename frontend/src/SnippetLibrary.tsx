import { Clipboard, Code2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { api, send } from "./api";

const languages = [
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
  "YAML",
];
type Draft = {
  id?: number;
  version?: number;
  title: string;
  language: string;
  content: string;
};
type Snippet = Required<Draft> & {
  author: string;
  canEdit: boolean;
  canDelete: boolean;
};
type SnippetPage = { items: Snippet[]; hasNext: boolean };

export default function SnippetLibrary({ projectId }: { projectId: number }) {
  const languageId = useId();
  const path = `/projects/${projectId}/snippets`;
  const [result, setResult] = useState<SnippetPage>({
    items: [],
    hasNext: false,
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const query = new URLSearchParams({ q: search, page: String(page) });
    api(`${path}?${query}`, { signal: controller.signal })
      .then((data: SnippetPage) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, search, page, revision]);

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not update snippets.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    await perform(async () => {
      const { id, title, content, language, version } = draft;
      await send(
        id ? `${path}/${id}` : path,
        { title, content, language, version },
        id ? "PUT" : "POST",
      );
      setDraft(null);
      if (!id) {
        setPage(0);
        setSearch("");
      }
      setNotice("Snippet saved.");
      setRevision((old) => old + 1);
    });
  }

  async function copy(snippet: Snippet) {
    try {
      await navigator.clipboard.writeText(snippet.content);
      setError("");
      setNotice(`Copied “${snippet.title}” to the clipboard.`);
    } catch {
      setError(
        "Clipboard access is unavailable. Select and copy the code directly.",
      );
    }
  }

  return (
    <section className="snippet-library" aria-label="Project snippets">
      <div className="filters snippet-toolbar">
        <label className="search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search snippets"
            placeholder="Search snippet titles"
            maxLength={100}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => {
            setError("");
            setDraft({ title: "", language: "Java", content: "" });
          }}
        >
          <Plus size={18} aria-hidden="true" /> New snippet
        </button>
      </div>
      {error && (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert alert-success" role="status">
          {notice}
        </p>
      )}
      {draft && (
        <form className="panel snippet-editor" onSubmit={save}>
          <h2>{draft.id ? "Edit snippet" : "Share a snippet"}</h2>
          <div className="form-grid">
            <label className="field">
              Snippet title
              <input
                className="form-control"
                required
                maxLength={100}
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
              />
            </label>
            <div className="field">
              <label htmlFor={languageId}>Language</label>
              <select
                id={languageId}
                className="form-select"
                value={draft.language}
                onChange={(event) =>
                  setDraft({ ...draft, language: event.target.value })
                }
              >
                {languages.map((language) => (
                  <option key={language}>{language}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="field">
            Snippet code
            <textarea
              className="form-control snippet-code-input"
              spellCheck={false}
              required
              maxLength={10000}
              rows={7}
              value={draft.content}
              onChange={(event) =>
                setDraft({ ...draft, content: event.target.value })
              }
            />
          </label>
          <div className="call-actions">
            <button className="btn btn-primary" disabled={busy}>
              Save snippet
            </button>
            <button
              type="button"
              className="btn btn-light"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {loading && (
        <p className="muted" role="status">
          Loading snippets…
        </p>
      )}
      {!loading && !result.items.length && (
        <div className="panel snippet-empty">
          <Code2 size={24} aria-hidden="true" />
          <p>
            {search
              ? "No snippets match your search."
              : "Share useful commands, queries, or code with the project team."}
          </p>
        </div>
      )}
      <div className="snippet-grid">
        {result.items.map((snippet) => (
          <article className="panel snippet-card" key={snippet.id}>
            <div className="section-title">
              <div>
                <h2>{snippet.title}</h2>
                <p className="muted mb-0">{snippet.author}</p>
              </div>
              <span className="badge-soft">{snippet.language}</span>
            </div>
            <pre tabIndex={0} aria-label={`Code for ${snippet.title}`}>
              <code>{snippet.content}</code>
            </pre>
            <div className="call-actions">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => void copy(snippet)}
              >
                <Clipboard size={16} aria-hidden="true" /> Copy code
              </button>
              {snippet.canEdit && (
                <button
                  type="button"
                  className="btn btn-light"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setDraft(snippet);
                  }}
                >
                  <Pencil size={16} aria-hidden="true" /> Edit snippet
                </button>
              )}
              {snippet.canDelete && (
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  disabled={busy}
                  onClick={() => setConfirmDelete(snippet.id)}
                >
                  <Trash2 size={16} aria-hidden="true" /> Delete snippet
                </button>
              )}
            </div>
            {confirmDelete === snippet.id && (
              <div className="snippet-delete">
                <p>Remove this snippet from the project?</p>
                <div className="call-actions">
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        await api(`${path}/${snippet.id}`, {
                          method: "DELETE",
                        });
                        if (draft?.id === snippet.id) setDraft(null);
                        setConfirmDelete(null);
                        if (page > 0 && result.items.length === 1)
                          setPage(page - 1);
                        setRevision((old) => old + 1);
                        setNotice("Snippet deleted.");
                      })
                    }
                  >
                    Confirm deletion
                  </button>
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={() => setConfirmDelete(null)}
                  >
                    Keep snippet
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
      {(page > 0 || result.hasNext) && (
        <div className="pagination-row">
          <button
            type="button"
            className="btn btn-light"
            disabled={!page || loading}
            onClick={() => setPage(page - 1)}
          >
            Previous snippets
          </button>
          <button
            type="button"
            className="btn btn-light"
            disabled={!result.hasNext || loading}
            onClick={() => setPage(page + 1)}
          >
            Next snippets
          </button>
        </div>
      )}
    </section>
  );
}
