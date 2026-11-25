import { AlertCircle, Bug, FolderKanban, ListTodo } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./api";

type Project = {
  id: number;
  name: string;
  total: number;
  completed: number;
  tasksInProgress: number;
  bugsInProgress: number;
  openBugs: number;
  review: number;
  overdue: number;
};

export default function Portfolio({
  openProject,
}: {
  openProject: (id: number) => void;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const request = new AbortController();
    api("/portfolio", { signal: request.signal })
      .then(setProjects)
      .catch(() => {
        if (!request.signal.aborted) setError("Could not load your projects.");
      });
    return () => request.abort();
  }, []);

  if (error)
    return (
      <p className="alert alert-danger" role="alert">
        {error}
      </p>
    );
  if (!projects)
    return (
      <p className="muted" role="status">
        Loading your projects…
      </p>
    );
  if (!projects.length)
    return (
      <p className="panel">
        Create a project or accept an invitation in Inbox.
      </p>
    );

  return (
    <div className="portfolio-grid">
      {projects.map((project) => {
        const percent = project.total
          ? Math.round((100 * project.completed) / project.total)
          : 0;
        return (
          <article className="panel portfolio-card" key={project.id}>
            <div className="section-title">
              <h2>
                <FolderKanban size={20} aria-hidden="true" /> {project.name}
              </h2>
              <strong>{percent}%</strong>
            </div>
            <progress
              aria-label={`${project.name} completion`}
              max={100}
              value={percent}
            />
            <p className="muted">
              {project.completed} of {project.total} complete · {project.review}{" "}
              in review
            </p>
            <dl>
              <div>
                <dt>
                  <ListTodo size={17} aria-hidden="true" /> Tasks in development
                </dt>
                <dd>{project.tasksInProgress}</dd>
              </div>
              <div>
                <dt>
                  <Bug size={17} aria-hidden="true" /> Bugs being fixed
                </dt>
                <dd>{project.bugsInProgress}</dd>
              </div>
              <div>
                <dt>Open bugs</dt>
                <dd>{project.openBugs}</dd>
              </div>
              <div>
                <dt>
                  <AlertCircle size={17} aria-hidden="true" /> Overdue
                </dt>
                <dd>{project.overdue}</dd>
              </div>
            </dl>
            <button
              className="btn btn-outline-primary"
              onClick={() => openProject(project.id)}
            >
              Open board
              <span className="visually-hidden"> for {project.name}</span>
            </button>
          </article>
        );
      })}
    </div>
  );
}
