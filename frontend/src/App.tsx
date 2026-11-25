import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useId,
  cloneElement,
} from "react";
import type { ReactNode, ReactElement, FormEvent, CSSProperties } from "react";
import {
  Layers,
  Moon,
  Sun,
  LayoutDashboard,
  Columns3,
  ListTodo,
  Bug,
  Users,
  Bell,
  Activity,
  CircleCheck,
  Clock3,
  Timer,
  CalendarDays,
  LogOut,
  Plus,
  Search,
  Sparkles,
  FolderKanban,
  Code2,
  GitPullRequest,
  MessageCircle,
} from "lucide-react";
import { api, ApiError, send, resetToken, statuses, label } from "./api";
import TeamInvites from "./TeamInvites";
import { initialTheme, saveTheme } from "./theme";
import SnippetLibrary from "./SnippetLibrary";
import Portfolio from "./Portfolio";
import ProjectComms from "./ProjectComms";
type Data = Record<string, any>;
function Dialog({
  title,
  close,
  children,
  error,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  error?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={close} aria-label={title}>
      <header className="dialog-head">
        <h2>{title}</h2>
        <button
          className="btn btn-light"
          onClick={close}
          aria-label="Close dialog"
        >
          ×
        </button>
      </header>
      {error && (
        <div role="alert" className="alert alert-danger">
          {error}
        </div>
      )}
      {children}
    </dialog>
  );
}
function Field({ name, children }: { name: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{name}</label>
      {cloneElement(children as ReactElement<{ id?: string }>, { id })}
    </div>
  );
}
const blank: Data = {
  title: "",
  description: "",
  type: "TASK",
  priority: "MEDIUM",
  status: "TODO",
  deadline: "",
  assigneeId: "",
  bug: {
    severity: "MEDIUM",
    steps: "",
    expectedBehavior: "",
    actualBehavior: "",
    category: "OTHER",
  },
};

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <section className={`stat ${tone}`}>
      <div className="stat-label">
        <span className="metric-icon" aria-hidden="true">
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
    </section>
  );
}

export default function App() {
  const [theme, setTheme] = useState(initialTheme);
  const darkMode = theme === "dark";
  const themeSwitch = (
    <button
      type="button"
      className="theme-switch"
      role="switch"
      aria-label="Dark mode"
      aria-checked={darkMode}
      title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const next = darkMode ? "light" : "dark";
        saveTheme(next);
        setTheme(next);
      }}
    >
      <Sun size={15} aria-hidden="true" />
      <Moon size={15} aria-hidden="true" />
    </button>
  );
  const [user, setUser] = useState<Data | null>(null),
    [boot, setBoot] = useState(true),
    [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(0);
  const [projects, setProjects] = useState<Data[]>([]),
    [projectId, setProjectId] = useState(0),
    [view, setView] = useState("Overview"),
    [members, setMembers] = useState<Data[]>([]),
    [items, setItems] = useState<Data[]>([]),
    [dashboard, setDashboard] = useState<Data | null>(null),
    [notifications, setNotifications] = useState<Data[]>([]),
    [invitations, setInvitations] = useState<Data[]>([]);
  const [activity, setActivity] = useState<{
    projectId: number;
    entries: Data[];
    page: number;
  } | null>(null);
  const [filter, setFilter] = useState({
      q: "",
      type: "",
      priority: "",
      status: "",
      assigneeId: "",
      overdue: "",
    }),
    [page, setPage] = useState(0),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false);
  const [projectForm, setProjectForm] = useState<Data | null>(null),
    [itemForm, setItemForm] = useState<Data | null>(null),
    [detail, setDetail] = useState<Data | null>(null),
    [comments, setComments] = useState<Data[]>([]),
    [comment, setComment] = useState(""),
    [summaryResponse, setSummary] = useState<{
      projectId: number;
      result: Data;
    } | null>(null),
    [suggestion, setSuggestion] = useState<Data | null>(null);
  const loadGeneration = useRef(0);
  const project = projects.find((p) => p.id === projectId),
    manager = project?.role === "MANAGER";
  const currentActivity = activity?.projectId === projectId ? activity : null;
  const [liveCallProject, setLiveCallProject] = useState<number | null>(null);
  const updateCallIndicator = useCallback(
    (live: boolean) => {
      setLiveCallProject((previous) =>
        live ? projectId : previous === projectId ? null : previous,
      );
    },
    [projectId],
  );
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  }
  async function loadGlobal(preferredProjectId?: number) {
    const [p, n, i, u] = await Promise.all([
      api("/projects"),
      api("/notifications"),
      api("/invitations"),
      api("/notifications/unread-count"),
    ]);
    setUnread(u.count);
    setProjects(p);
    setNotifications(n);
    setInvitations(i);
    setProjectId((old) => {
      const preferred = preferredProjectId ?? old;
      return p.some((x: Data) => x.id === preferred)
        ? preferred
        : p[0]?.id || 0;
    });
  }
  async function loadProject() {
    if (!projectId) return;
    const generation = ++loadGeneration.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...filter,
        page: String(page),
        size: "20",
      });
      const [w, m, d] = await Promise.all([
        api(`/projects/${projectId}/work-items?${params}`),
        api(`/projects/${projectId}/members`),
        api(`/projects/${projectId}/dashboard`),
      ]);
      if (generation !== loadGeneration.current) return;
      setItems(w.items);
      setTotal(w.total);
      setMembers(m);
      setDashboard(d);
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }
  async function refresh() {
    await Promise.all([loadGlobal(), loadProject()]);
  }
  useEffect(() => {
    api("/auth/me")
      .then(async (u) => {
        setUser(u);
        await loadGlobal();
      })
      .catch(() => {})
      .finally(() => setBoot(false));
  }, []);
  useEffect(() => {
    if (user && view === "Inbox") run(loadGlobal);
    else if (user && projectId) run(loadProject);
  }, [user, projectId, filter, page, view]);
  useEffect(() => {
    if (!user || view !== "Activity") return;
    setActivity(null);
    if (!manager) {
      setView("Overview");
      return;
    }
    const request = new AbortController();
    api(`/projects/${projectId}/activity`, { signal: request.signal })
      .then((entries) => {
        if (!request.signal.aborted)
          setActivity({ projectId, entries, page: 0 });
      })
      .catch((cause: unknown) => {
        if (request.signal.aborted) return;
        if (cause instanceof ApiError && cause.status === 403) {
          setView("Overview");
          void loadGlobal().catch(() => {});
        } else {
          setError(
            cause instanceof Error ? cause.message : "Could not load activity.",
          );
        }
      });
    return () => request.abort();
  }, [user, projectId, manager, view]);
  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      void loadGlobal().catch(() => {});
    }, 20000);
    return () => window.clearInterval(timer);
  }, [user]);
  async function auth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    await run(async () => {
      if (register) await send("/auth/register", data);
      setUser(await send("/auth/login", data));
      resetToken();
      await loadGlobal();
    });
  }
  async function openItem(id: number) {
    await run(async () => {
      setSuggestion(null);
      const [w, c] = await Promise.all([
        api(`/work-items/${id}`),
        api(`/work-items/${id}/comments`),
      ]);
      setDetail(w);
      setComments(c);
      setComment("");
    });
  }
  async function saveItem(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const d = {
        ...itemForm,
        assigneeId: itemForm?.assigneeId ? Number(itemForm.assigneeId) : null,
      };
      await send(
        itemForm?.id
          ? `/work-items/${itemForm.id}`
          : `/projects/${projectId}/work-items`,
        d,
        itemForm?.id ? "PUT" : "POST",
      );
      setItemForm(null);
      setDetail(null);
      setSuggestion(null);
      await refresh();
    });
  }
  const newProject = () =>
    setProjectForm({
      name: "",
      description: "",
      timezone: "Asia/Kolkata",
      deadline: "",
    });
  const newItem = () =>
    run(async () => {
      setMembers(await api(`/projects/${projectId}/members`));
      setItemForm({ ...blank, bug: { ...blank.bug } });
    });
  const changeFilter = (key: string, value: string) => {
    setFilter((f) => ({ ...f, [key]: value }));
    setPage(0);
  };
  function chooseProject(id: number) {
    if (id === projectId) return;
    loadGeneration.current++;
    setProjectId(id);
    setPage(0);
    setFilter({
      q: "",
      type: "",
      priority: "",
      status: "",
      assigneeId: "",
      overdue: "",
    });
    setItems([]);
    setTotal(0);
    setMembers([]);
    setDashboard(null);
    setActivity(null);
    setSummary(null);
    setDetail(null);
  }
  const updateItemField = (key: string, value: string) =>
    setItemForm({ ...itemForm, [key]: value });
  const updateBug = (key: string, value: string) =>
    setItemForm({
      ...itemForm,
      bug: { ...blank.bug, ...itemForm?.bug, [key]: value },
    });
  const selectField = (key: string, values: string[], bug = false) => (
    <Field key={key} name={label(key)}>
      <select
        className="form-select"
        value={bug ? itemForm?.bug?.[key] : itemForm?.[key]}
        onChange={(e) =>
          bug
            ? updateBug(key, e.target.value)
            : updateItemField(key, e.target.value)
        }
      >
        {values.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </Field>
  );
  if (boot)
    return (
      <main className="auth">
        <p>Opening your workspace…</p>
      </main>
    );
  if (!user)
    return (
      <main className="auth">
        <div className="auth-theme">{themeSwitch}</div>
        <form className="auth-card" onSubmit={auth}>
          <div className="brand">
            <Layers aria-hidden="true" /> DevSync
          </div>
          <h1>{register ? "Create your account" : "Sign in to DevSync"}</h1>
          {register && (
            <p className="muted">
              Use at least 8 characters for your password.
            </p>
          )}
          {error && (
            <div role="alert" className="alert alert-danger">
              {error}
            </div>
          )}
          {register && (
            <Field name="Full name">
              <input
                className="form-control"
                name="name"
                required
                maxLength={100}
                autoComplete="name"
              />
            </Field>
          )}
          <Field name="Email">
            <input
              className="form-control"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </Field>
          <Field name="Password">
            <input
              className="form-control"
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete={register ? "new-password" : "current-password"}
            />
          </Field>
          <button className="btn btn-primary w-100" disabled={busy}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
          </button>
          <button
            type="button"
            className={`btn w-100 mt-3 ${register ? "btn-link" : "btn-outline-primary"}`}
            disabled={busy}
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "Back to sign in" : "Create account"}
          </button>
        </form>
      </main>
    );
  const summary =
    summaryResponse?.projectId === projectId ? summaryResponse.result : null;
  const projectSummary = (
    <section className="panel ai-panel">
      <span className="insight-icon">
        <Sparkles size={20} aria-hidden="true" />
      </span>
      <h2>Project briefing</h2>
      <p className="muted">
        Review progress and the work that needs attention.
      </p>
      <button
        className="btn btn-outline-primary"
        disabled={busy}
        onClick={() =>
          run(async () =>
            setSummary({
              projectId,
              result: await send(`/projects/${projectId}/ai/summary`, {}),
            }),
          )
        }
      >
        Generate summary
      </button>
      {summary && (
        <div className="ai-result">
          <strong>{summary.provider}</strong>
          <p>{summary.summary}</p>
          {!!summary.facts?.attention?.length && (
            <div className="brief-section">
              <h3>Needs attention</h3>
              <ul>
                {summary.facts.attention.map(
                  (item: { id: number; title: string; reason: string }) => (
                    <li key={item.id}>
                      <button
                        className="item-title"
                        onClick={() => void openItem(item.id)}
                      >
                        {item.title}
                      </button>
                      <small>{item.reason}</small>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
          {!!summary.facts?.completedWork?.length && (
            <div className="brief-section">
              <h3>Completed work</h3>
              <ul>
                {summary.facts.completedWork.map(
                  (title: string, index: number) => (
                    <li key={index}>{title}</li>
                  ),
                )}
              </ul>
            </div>
          )}
          <small>{new Date(summary.generatedAt).toLocaleString()}</small>
          {summary.notice && <p>{summary.notice}</p>}
        </div>
      )}
    </section>
  );
  const navigation = [
    ["Projects", FolderKanban],
    ["Overview", LayoutDashboard],
    ["Board", Columns3],
    ["Work items", ListTodo],
    ["Team", Users],
    ["Activity", Activity],
    ["Inbox", Bell],
    ["AI tools", Sparkles],
    ["Snippets", Code2],
    ["Chat", MessageCircle],
  ] as const;
  return (
    <div className="shell">
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <div className="brand">
            <Layers aria-hidden="true" /> DevSync
          </div>
          <nav className="workspace-nav" aria-label="Workspace navigation">
            {navigation
              .filter(([name]) => name !== "Activity" || manager)
              .map(([name, Icon]) => (
                <button
                  key={name}
                  className={view === name ? "nav-item active" : "nav-item"}
                  onClick={() => setView(name)}
                  aria-current={view === name ? "page" : undefined}
                >
                  <Icon size={16} aria-hidden="true" />
                  {name}
                  {name === "Chat" && projectId === liveCallProject && (
                    <span className="call-live-dot" aria-hidden="true" />
                  )}
                  {name === "Inbox" && (
                    <span className="counter">
                      {unread + invitations.length}
                    </span>
                  )}
                </button>
              ))}
          </nav>
          <div className="workspace-account">
            {themeSwitch}
            <div className="avatar" aria-hidden="true">
              {user.name[0]}
            </div>
            <div className="account-name">
              <strong>{user.name}</strong>
              <small>
                {project ? label(project.role) : "Personal workspace"}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() =>
                run(async () => {
                  await send("/auth/logout", {});
                  resetToken();
                  setUser(null);
                  setRegister(false);
                  setProjects([]);
                  setProjectId(0);
                })
              }
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="content">
        <div className="page">
          <div className="project-toolbar">
            <div className="project-picker">
              <FolderKanban size={18} aria-hidden="true" />
              <select
                aria-label="Current project"
                className="form-select"
                value={projectId || ""}
                onChange={(e) => chooseProject(Number(e.target.value))}
              >
                <option value="" disabled>
                  Select a project
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-light new-project" onClick={newProject}>
              <Plus size={16} /> New project
            </button>
            {project?.deadline && (
              <div className="project-deadline">
                <CalendarDays size={16} aria-hidden="true" />
                <span>
                  Due{" "}
                  <time dateTime={project.deadline}>{project.deadline}</time>
                </span>
              </div>
            )}
          </div>
          <div className="page-heading">
            <div>
              <h1>{view}</h1>
              {view === "Overview" && project?.description && (
                <p className="muted">{project.description}</p>
              )}
            </div>
            {project && ["Overview", "Board", "Work items"].includes(view) && (
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={newItem}
              >
                <Plus size={18} /> New work item
              </button>
            )}
          </div>
          {error && (
            <div
              role="alert"
              className="alert alert-danger d-flex justify-content-between"
            >
              {error}
              <button
                className="btn-close"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              />
            </div>
          )}
          {loading && (
            <div role="status" className="muted mb-3">
              Updating workspace…
            </div>
          )}
          <ProjectComms
            key={user.id}
            projectId={project?.id ?? 0}
            projectName={project?.name ?? ""}
            userId={user.id}
            visible={view === "Chat"}
            showChat={() => setView("Chat")}
            onLiveChange={updateCallIndicator}
            live={projectId === liveCallProject}
          />
          {view === "Projects" ? (
            <Portfolio
              openProject={(id) => {
                chooseProject(id);
                setView("Board");
              }}
            />
          ) : !project && view !== "Inbox" && view !== "Chat" ? (
            <section className="empty">
              <FolderKanban size={48} />
              <h2>A fresh start for your team</h2>
              <p>Create a project or accept an invitation in your inbox.</p>
              <button className="btn btn-primary" onClick={newProject}>
                Create project
              </button>
            </section>
          ) : (
            <>
              {view === "Overview" && dashboard && (
                <>
                  <div className="stats">
                    <Stat
                      label="All work"
                      value={dashboard.total}
                      tone="ink"
                      icon={<ListTodo size={19} />}
                    />
                    <Stat
                      label="Completed"
                      value={dashboard.statuses.DONE}
                      tone="teal"
                      icon={<CircleCheck size={19} />}
                    />
                    <Stat
                      label="In progress"
                      value={dashboard.statuses.IN_PROGRESS}
                      tone="blue"
                      icon={<Timer size={19} />}
                    />
                    <Stat
                      label="Overdue"
                      value={dashboard.overdue}
                      tone="amber"
                      icon={<Clock3 size={19} />}
                    />
                  </div>
                  <div className="overview-grid">
                    <section className="panel momentum-panel">
                      <h2>Project progress</h2>
                      <div className="momentum-content">
                        <div
                          className="completion-ring"
                          style={
                            {
                              "--completion": `${dashboard.completion}%`,
                            } as CSSProperties
                          }
                        >
                          <div className="completion-label">
                            <strong>{Math.round(dashboard.completion)}%</strong>
                            <span>Complete</span>
                          </div>
                        </div>
                        <div>
                          {statuses.map((s) => (
                            <div className="metric-row" key={s}>
                              <span>{label(s)}</span>
                              <div
                                className="bar"
                                data-status={s}
                                aria-hidden="true"
                              >
                                <i
                                  style={{
                                    width: `${dashboard.total ? (100 * dashboard.statuses[s]) / dashboard.total : 0}%`,
                                  }}
                                />
                              </div>
                              <strong>{dashboard.statuses[s]}</strong>
                            </div>
                          ))}
                          <div className="counts">
                            <span>
                              <ListTodo size={17} /> {dashboard.tasks} tasks
                            </span>
                            <span>
                              <Bug size={17} /> {dashboard.bugs} bugs
                            </span>
                          </div>
                        </div>
                      </div>
                    </section>
                    {projectSummary}
                    <section className="panel">
                      <h2>Team workload</h2>
                      {dashboard.workload.map((m: Data) => (
                        <div className="person-row" key={m.name}>
                          <span className="member-name">
                            <span className="avatar" aria-hidden="true">
                              {m.name[0]}
                            </span>
                            {m.name}
                          </span>
                          <span className="badge-soft">{m.count} open</span>
                        </div>
                      ))}
                    </section>
                    <section className="panel">
                      <h2>Open bugs by severity</h2>
                      {Object.entries(dashboard.severity).map(([s, n]) => (
                        <div className="person-row" key={s}>
                          <span className="severity-label" data-severity={s}>
                            {label(s)}
                          </span>
                          <strong>{String(n)}</strong>
                        </div>
                      ))}
                    </section>
                  </div>
                </>
              )}
              {["Board", "Work items"].includes(view) && (
                <>
                  <div className="filters">
                    <label className="search">
                      <Search size={18} />
                      <input
                        aria-label="Search work items"
                        placeholder="Search work items…"
                        value={filter.q}
                        onChange={(e) => changeFilter("q", e.target.value)}
                      />
                    </label>
                    {[
                      ["type", ["TASK", "BUG"]],
                      ["priority", ["LOW", "MEDIUM", "HIGH", "URGENT"]],
                      ["status", statuses],
                    ].map(([key, values]) => (
                      <select
                        className="form-select"
                        aria-label={`Filter ${key}`}
                        key={key as string}
                        value={filter[key as "type"]}
                        onChange={(e) =>
                          changeFilter(key as string, e.target.value)
                        }
                      >
                        <option value="">All {key}</option>
                        {(values as string[]).map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    ))}
                    <select
                      className="form-select"
                      aria-label="Filter assignee"
                      value={filter.assigneeId}
                      onChange={(e) =>
                        changeFilter("assigneeId", e.target.value)
                      }
                    >
                      <option value="">All assignees</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={filter.overdue === "true"}
                        onChange={(e) =>
                          changeFilter(
                            "overdue",
                            e.target.checked ? "true" : "",
                          )
                        }
                      />{" "}
                      Overdue
                    </label>
                  </div>
                  {view === "Board" ? (
                    <div
                      className="board"
                      role="region"
                      aria-label="Work item board"
                      tabIndex={0}
                    >
                      {statuses.map((s) => (
                        <section className="column" data-status={s} key={s}>
                          <h2>
                            <span className="status-dot" aria-hidden="true" />
                            {label(s)}
                            <span className="lane-count">
                              {items.filter((w) => w.status === s).length}
                            </span>
                          </h2>
                          {items
                            .filter((w) => w.status === s)
                            .map((w) => (
                              <article className="work-card" key={w.id}>
                                <div className="card-meta">
                                  <span>
                                    {w.type === "BUG" ? (
                                      <Bug size={15} />
                                    ) : (
                                      <ListTodo size={15} />
                                    )}{" "}
                                    {w.type} · #{w.id}
                                  </span>
                                  <span className={`priority ${w.priority}`}>
                                    {label(w.priority)}
                                  </span>
                                </div>
                                <button
                                  className="item-title"
                                  onClick={() => openItem(w.id)}
                                >
                                  {w.title}
                                </button>
                                {w.description && <p>{w.description}</p>}
                                <div className="card-footer">
                                  <span>
                                    {members.find(
                                      (m) => m.userId === w.assigneeId,
                                    )?.name || "Unassigned"}
                                  </span>
                                  {w.deadline && (
                                    <time dateTime={w.deadline}>
                                      {w.deadline}
                                    </time>
                                  )}
                                </div>
                                <select
                                  className="form-select form-select-sm mt-3"
                                  aria-label={`Status for ${w.title}`}
                                  value={w.status}
                                  disabled={busy}
                                  onChange={(e) =>
                                    run(async () => {
                                      await send(
                                        `/work-items/${w.id}`,
                                        { ...w, status: e.target.value },
                                        "PUT",
                                      );
                                      await refresh();
                                    })
                                  }
                                >
                                  {statuses.map((s) => (
                                    <option key={s} value={s}>
                                      {label(s)}
                                    </option>
                                  ))}
                                </select>
                              </article>
                            ))}
                          {!items.some((w) => w.status === s) && (
                            <div className="column-empty">No work items</div>
                          )}
                        </section>
                      ))}
                    </div>
                  ) : (
                    <section className="panel table-responsive">
                      <table className="table align-middle">
                        <thead>
                          <tr>
                            <th>Work item</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Assignee</th>
                            <th>Deadline</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((w) => (
                            <tr key={w.id}>
                              <td>
                                <button
                                  className="item-title"
                                  onClick={() => openItem(w.id)}
                                >
                                  {w.type === "BUG" ? "Bug" : "Task"} #{w.id} ·{" "}
                                  {w.title}
                                </button>
                              </td>
                              <td>{label(w.status)}</td>
                              <td>{label(w.priority)}</td>
                              <td>
                                {members.find((m) => m.userId === w.assigneeId)
                                  ?.name || "Unassigned"}
                              </td>
                              <td>{w.deadline || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!items.length && (
                        <p className="empty-small">
                          No work items match these filters.
                        </p>
                      )}
                    </section>
                  )}
                  <div className="pagination-row">
                    <span>
                      {total} matching items · page {page + 1}. Board columns
                      show this page.
                    </span>
                    <div>
                      <button
                        className="btn btn-light"
                        disabled={!page || busy}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous
                      </button>
                      <button
                        className="btn btn-light ms-2"
                        disabled={(page + 1) * 20 >= total || busy}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
              {view === "Team" && (
                <section className="panel">
                  <div className="section-title">
                    <h2>Project members</h2>
                    {manager && (
                      <button
                        className="btn btn-light"
                        onClick={() => setProjectForm({ ...project })}
                      >
                        Project settings
                      </button>
                    )}
                  </div>
                  {manager && (
                    <TeamInvites key={projectId} projectId={projectId} />
                  )}
                  {members.map((m) => (
                    <div className="person-row" key={m.userId}>
                      <div>
                        <strong>{m.name}</strong>
                        <small className="muted d-block">{label(m.role)}</small>
                      </div>
                      {manager && (
                        <div className="d-flex gap-2">
                          <select
                            aria-label={`Role for ${m.name}`}
                            className="form-select"
                            value={m.role}
                            disabled={busy}
                            onChange={(e) =>
                              run(async () => {
                                await send(
                                  `/projects/${projectId}/members/${m.userId}`,
                                  { role: e.target.value },
                                  "PUT",
                                );
                                await refresh();
                              })
                            }
                          >
                            <option>MANAGER</option>
                            <option>DEVELOPER</option>
                          </select>
                          <button
                            className="btn btn-outline-danger"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove ${m.name} from this project?`,
                                )
                              )
                                run(async () => {
                                  await api(
                                    `/projects/${projectId}/members/${m.userId}`,
                                    { method: "DELETE" },
                                  );
                                  await refresh();
                                });
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              )}
              {view === "AI tools" && (
                <div className="ai-tools">
                  {projectSummary}
                  <section className="panel">
                    <span className="insight-icon">
                      <Bug size={20} aria-hidden="true" />
                    </span>
                    <h2>AI bug classification</h2>
                    <p className="muted">
                      Open a bug and choose Suggest category. Review the
                      suggestion before applying it.
                    </p>
                    <button
                      className="btn btn-outline-primary"
                      onClick={() => {
                        setFilter({
                          q: "",
                          type: "BUG",
                          priority: "",
                          status: "",
                          assigneeId: "",
                          overdue: "",
                        });
                        setPage(0);
                        setView("Work items");
                      }}
                    >
                      Browse bugs
                    </button>
                  </section>
                </div>
              )}
              {view === "Snippets" && (
                <SnippetLibrary key={projectId} projectId={projectId} />
              )}
              {view === "Activity" && manager && (
                <section className="panel">
                  <h2>Recent activity</h2>
                  {!currentActivity && !error && (
                    <p className="muted" role="status">
                      Loading activity…
                    </p>
                  )}
                  {currentActivity?.entries.map((e) => (
                    <div className="activity-row" key={e.id}>
                      <span className="avatar">{e.actor[0]}</span>
                      <div>
                        <strong>{e.actor}</strong> · {label(e.event)}
                        <p>
                          {e.oldValue && `${e.oldValue} → `}
                          {e.newValue || ""}
                        </p>
                        <small className="muted">
                          {new Date(e.createdAt).toLocaleString()}
                        </small>
                      </div>
                    </div>
                  ))}
                  {currentActivity &&
                    currentActivity.entries.length > 0 &&
                    currentActivity.entries.length % 30 === 0 && (
                      <button
                        className="btn btn-light mt-3"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            const next = currentActivity.page + 1;
                            const more = await api(
                              `/projects/${projectId}/activity?page=${next}`,
                            );
                            setActivity((old) =>
                              old === currentActivity
                                ? {
                                    projectId,
                                    page: next,
                                    entries: [...old.entries, ...more],
                                  }
                                : old,
                            );
                          })
                        }
                      >
                        Load more activity
                      </button>
                    )}
                </section>
              )}
              {view === "Inbox" && (
                <section className="panel">
                  <h2>Invitations</h2>
                  {invitations.map((i) => (
                    <div className="person-row" key={i.id}>
                      <strong>{i.projectName}</strong>
                      <div>
                        {[true, false].map((accept) => (
                          <button
                            key={String(accept)}
                            className="btn btn-light ms-2"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await send(`/invitations/${i.id}/respond`, {
                                  accept,
                                });
                                await loadGlobal(
                                  accept ? i.projectId : undefined,
                                );
                                if (accept) {
                                  setPage(0);
                                  setFilter({
                                    q: "",
                                    type: "",
                                    priority: "",
                                    status: "",
                                    assigneeId: "",
                                    overdue: "",
                                  });
                                  setSummary(null);
                                  setView("Overview");
                                }
                              })
                            }
                          >
                            {accept ? "Accept" : "Decline"}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!invitations.length && (
                    <p className="muted">No pending invitations.</p>
                  )}
                  <h2 className="mt-4">Notifications</h2>
                  {notifications.map((n) => (
                    <div
                      className={"person-row " + (!n.read ? "unread" : "")}
                      key={n.id}
                    >
                      <div>
                        <button
                          className="item-title"
                          onClick={() =>
                            run(async () => {
                              await send(`/notifications/${n.id}/read`, {});
                              await loadGlobal();
                              setProjectId(n.projectId);
                              if (n.workItemId) await openItem(n.workItemId);
                            })
                          }
                        >
                          {n.message}
                        </button>
                        <small className="muted d-block">
                          {new Date(n.createdAt).toLocaleString()}
                        </small>
                      </div>
                      {!n.read && (
                        <button
                          className="btn btn-light"
                          onClick={() =>
                            run(async () => {
                              await send(`/notifications/${n.id}/read`, {});
                              await loadGlobal();
                            })
                          }
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  ))}
                  {!notifications.length && (
                    <p className="muted">You’re all caught up.</p>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </main>
      {projectForm && (
        <Dialog
          error={error}
          title={projectForm.id ? "Project settings" : "Create project"}
          close={() => setProjectForm(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const p = await send(
                  projectForm.id ? `/projects/${projectForm.id}` : "/projects",
                  projectForm,
                  projectForm.id ? "PUT" : "POST",
                );
                setProjectForm(null);
                setProjectId(p.id);
                await loadGlobal();
              });
            }}
          >
            {[
              ["name", "Project name"],
              ["description", "Description"],
              ["deadline", "Deadline"],
              ["timezone", "Timezone"],
            ].map(([key, title]) => (
              <Field key={key} name={title}>
                <input
                  className="form-control"
                  type={key === "deadline" ? "date" : "text"}
                  required={["name", "timezone"].includes(key)}
                  value={projectForm[key] || ""}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, [key]: e.target.value })
                  }
                />
              </Field>
            ))}
            <button className="btn btn-primary" disabled={busy}>
              Save project
            </button>
          </form>
        </Dialog>
      )}
      {itemForm && (
        <Dialog
          error={error}
          title={itemForm.id ? "Edit work item" : "New work item"}
          close={() => setItemForm(null)}
        >
          <form onSubmit={saveItem}>
            <Field name="Title">
              <input
                className="form-control"
                required
                maxLength={200}
                value={itemForm.title}
                onChange={(e) => updateItemField("title", e.target.value)}
              />
            </Field>
            <Field name="Description">
              <textarea
                className="form-control"
                value={itemForm.description}
                onChange={(e) => updateItemField("description", e.target.value)}
              />
            </Field>
            <Field name="Pull request URL">
              <input
                className="form-control"
                type="url"
                maxLength={2048}
                placeholder="https://github.com/org/repo/pull/42"
                value={itemForm.reviewUrl ?? ""}
                onChange={(event) =>
                  updateItemField("reviewUrl", event.target.value)
                }
              />
            </Field>
            <div className="form-grid">
              {selectField("type", ["TASK", "BUG"])}
              {selectField("priority", ["LOW", "MEDIUM", "HIGH", "URGENT"])}
              {selectField("status", statuses)}
              <Field name="Assignee">
                <select
                  className="form-select"
                  value={itemForm.assigneeId || ""}
                  onChange={(e) =>
                    updateItemField("assigneeId", e.target.value)
                  }
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field name="Deadline">
                <input
                  className="form-control"
                  type="date"
                  value={itemForm.deadline || ""}
                  onChange={(e) => updateItemField("deadline", e.target.value)}
                />
              </Field>
            </div>
            {itemForm.type === "BUG" && (
              <fieldset>
                <legend>Bug details</legend>
                {selectField(
                  "severity",
                  ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                  true,
                )}
                {selectField(
                  "category",
                  [
                    "UI",
                    "BACKEND",
                    "DATABASE",
                    "AUTHENTICATION",
                    "PERFORMANCE",
                    "OTHER",
                  ],
                  true,
                )}
                {[
                  ["steps", "Reproduction steps"],
                  ["expectedBehavior", "Expected behavior"],
                  ["actualBehavior", "Actual behavior"],
                ].map(([key, title]) => (
                  <Field key={key} name={title}>
                    <textarea
                      className="form-control"
                      required={key === "steps"}
                      value={itemForm.bug?.[key] || ""}
                      onChange={(e) => updateBug(key, e.target.value)}
                    />
                  </Field>
                ))}
              </fieldset>
            )}
            <button className="btn btn-primary" disabled={busy}>
              Save work item
            </button>
          </form>
        </Dialog>
      )}
      {detail && !itemForm && (
        <Dialog
          error={error}
          title={`#${detail.id} · ${detail.title}`}
          close={() => {
            setDetail(null);
            setSuggestion(null);
          }}
        >
          <div className="d-flex gap-2 mb-3">
            <span className="badge-soft">{detail.type}</span>
            <span className="badge-soft">{label(detail.status)}</span>
            <span className="badge-soft">{label(detail.priority)}</span>
          </div>
          <p className="preserve">{detail.description || "No description."}</p>
          {detail.reviewUrl && (
            <p>
              <a
                className="review-link"
                href={detail.reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitPullRequest size={16} aria-hidden="true" /> Open pull
                request
              </a>
            </p>
          )}
          <div className="d-flex gap-2 mb-4">
            <button
              className="btn btn-primary"
              onClick={() =>
                setItemForm({ ...detail, bug: detail.bug || { ...blank.bug } })
              }
            >
              Edit work item
            </button>
            {manager && (
              <button
                className="btn btn-outline-danger"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Delete this work item and its comments?"))
                    run(async () => {
                      await api(`/work-items/${detail.id}`, {
                        method: "DELETE",
                      });
                      setDetail(null);
                      await refresh();
                    });
                }}
              >
                Delete
              </button>
            )}
          </div>
          {detail.bug && (
            <section className="bug-info">
              <h3>Bug details</h3>
              <p>
                {detail.bug.severity} severity · {detail.bug.category}
              </p>
              {[
                ["steps", "Reproduction steps"],
                ["expectedBehavior", "Expected behavior"],
                ["actualBehavior", "Actual behavior"],
              ].map(([key, title]) => (
                <div key={key}>
                  <strong>{title}</strong>
                  <p className="preserve">{detail.bug[key] || "—"}</p>
                </div>
              ))}
              <button
                className="btn btn-outline-primary"
                disabled={busy}
                onClick={() =>
                  run(async () =>
                    setSuggestion(
                      await send(`/work-items/${detail.id}/ai/category`, {}),
                    ),
                  )
                }
              >
                <Sparkles size={16} /> Suggest category
              </button>
              {suggestion && (
                <div className="ai-result">
                  <strong>
                    {suggestion.provider}: {suggestion.category}
                  </strong>
                  <p>{suggestion.explanation}</p>
                  {suggestion.nextCheck && (
                    <p>
                      <strong>What to check</strong>
                      <br />
                      {suggestion.nextCheck}
                    </p>
                  )}
                  {suggestion.notice && <p>{suggestion.notice}</p>}
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        setDetail(
                          await send(
                            `/work-items/${detail.id}`,
                            {
                              ...detail,
                              bug: {
                                ...detail.bug,
                                category: suggestion.category,
                              },
                            },
                            "PUT",
                          ),
                        );
                        setSuggestion(null);
                        await refresh();
                      })
                    }
                  >
                    Accept category
                  </button>
                </div>
              )}
            </section>
          )}
          <h3 className="mt-4">Conversation</h3>
          {comments.map((c) => (
            <div className="comment" key={c.id}>
              <strong>{c.authorName}</strong>
              <small className="muted ms-2">
                {new Date(c.createdAt).toLocaleString()}
              </small>
              <p className="preserve">{c.content}</p>
              {c.authorId === user.id && (
                <button
                  className="btn btn-sm btn-light me-2"
                  onClick={() => {
                    const content = window.prompt("Edit comment", c.content);
                    if (content)
                      run(async () => {
                        await send(`/comments/${c.id}`, { content }, "PUT");
                        setComments(
                          await api(`/work-items/${detail.id}/comments`),
                        );
                      });
                  }}
                >
                  Edit comment
                </button>
              )}
              {(c.authorId === user.id || manager) && (
                <button
                  className="btn btn-sm btn-light"
                  onClick={() =>
                    run(async () => {
                      await api(`/comments/${c.id}`, { method: "DELETE" });
                      setComments(
                        await api(`/work-items/${detail.id}/comments`),
                      );
                    })
                  }
                >
                  Delete comment
                </button>
              )}
            </div>
          ))}
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await send(`/work-items/${detail.id}/comments`, {
                  content: comment,
                });
                setComment("");
                setComments(await api(`/work-items/${detail.id}/comments`));
                await loadGlobal();
              });
            }}
          >
            <Field name="Add a comment">
              <textarea
                className="form-control"
                required
                maxLength={5000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </Field>
            <button className="btn btn-primary" disabled={busy}>
              Post comment
            </button>
          </form>
        </Dialog>
      )}
      {busy && (
        <span className="saving" role="status">
          Working…
        </span>
      )}
    </div>
  );
}
