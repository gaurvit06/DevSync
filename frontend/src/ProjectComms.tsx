import { LockKeyhole, MessageCircle } from "lucide-react";
import { useCallback, useState } from "react";
import CallRoom from "./calls/CallRoom";
import ChatConversation from "./ChatConversation";
import DirectChat from "./DirectChat";

export default function ProjectComms({
  projectId,
  projectName,
  userId,
  visible,
  showChat,
  onLiveChange,
  live,
}: {
  projectId: number;
  projectName: string;
  userId: number;
  visible: boolean;
  showChat: () => void;
  onLiveChange: (live: boolean) => void;
  live: boolean;
}) {
  const [pane, setPane] = useState<"project" | "direct">("project");
  const [activePath, setActivePath] = useState<string | null>(null);
  const onSessionChange = useCallback((path: string, active: boolean) => {
    setActivePath((previous) =>
      active ? path : previous === path ? null : previous,
    );
  }, []);
  const activePane = projectId ? pane : "direct";
  const showGroup = visible && activePane === "project";
  const callPath = `/projects/${projectId}/call`;

  return (
    <>
      {visible && (
        <div className="panel comms-toolbar">
          <strong>
            {activePane === "direct" ? "Private conversations" : projectName}
          </strong>
          <div aria-label="Chat views">
            <button
              type="button"
              className={`btn ${activePane === "project" ? "btn-primary" : "btn-light"}`}
              aria-pressed={activePane === "project"}
              disabled={!projectId}
              onClick={() => setPane("project")}
            >
              <MessageCircle size={17} aria-hidden="true" /> Group chat
              {live && (
                <span className="call-live-dot" aria-label="Live call" />
              )}
            </button>
            <button
              type="button"
              className={`btn ${activePane === "direct" ? "btn-primary" : "btn-light"}`}
              aria-pressed={activePane === "direct"}
              onClick={() => setPane("direct")}
            >
              <LockKeyhole size={17} aria-hidden="true" /> Direct messages
            </button>
          </div>
        </div>
      )}
      {!!projectId && (
        <div className="chat-with-call">
          <CallRoom
            key={callPath}
            path={callPath}
            userId={userId}
            visible={showGroup}
            activePath={activePath}
            onSessionChange={onSessionChange}
            openCallRoom={() => {
              setPane("project");
              showChat();
            }}
            onLiveChange={onLiveChange}
          />
          <ChatConversation
            key={`messages-${projectId}`}
            path={`/projects/${projectId}/messages`}
            roleProject={projectName}
            userId={userId}
            visible={showGroup}
          />
        </div>
      )}
      <DirectChat
        userId={userId}
        projectId={projectId}
        projectName={projectName}
        visible={visible && activePane === "direct"}
        activePath={activePath}
        onSessionChange={onSessionChange}
        openDirectChat={() => {
          setPane("direct");
          showChat();
        }}
      />
    </>
  );
}
