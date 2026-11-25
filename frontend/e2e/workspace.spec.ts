import { test, expect, Page, BrowserContext } from "@playwright/test";
import fs from "node:fs";
test.use({
  actionTimeout: process.env.E2E_URL?.startsWith("https://") ? 25000 : 10000,
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  },
});
const stamp = Date.now(),
  password = "Browser123!";
const email = (name: string) => `${name}.${stamp}@example.test`;
async function register(page: Page, name: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email(name));
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
}
async function request(
  c: BrowserContext,
  path: string,
  data?: unknown,
  method = "GET",
) {
  const r = await c.request.get("/api/auth/csrf");
  const { token } = await r.json();
  return c.request.fetch("/api" + path, {
    method,
    data,
    headers: { "X-XSRF-TOKEN": token },
  });
}
test("A01–A14 integrated team workflow and responsive browser evidence", async ({
  browser,
}) => {
  const m = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
      viewport: { width: 1440, height: 1000 },
    }),
    d = await browser.newContext({ baseURL: test.info().project.use.baseURL }),
    o = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const manager = await m.newPage(),
    developer = await d.newPage(),
    outsider = await o.newPage();
  const errors: string[] = [];
  manager.on("pageerror", (e) => errors.push(e.message));
  developer.on("pageerror", (e) => errors.push(e.message));
  await register(manager, "Maya");
  await register(developer, "Arjun");
  await register(outsider, "Visitor");
  await manager
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await manager.getByLabel("Project name", { exact: true }).fill("Launchpad");
  await manager
    .getByLabel("Description", { exact: true })
    .fill("A focused release for our student team.");
  await manager
    .getByRole("button", { name: "Save project", exact: true })
    .click();
  await expect(manager.getByRole("dialog")).toHaveCount(0);
  await manager.getByRole("button", { name: "Team", exact: true }).click();
  await manager.getByLabel("Invite email").fill(email("Unregistered"));
  await manager.getByRole("button", { name: "Send invitation" }).click();
  await expect(manager.getByRole("alert")).toContainText(
    "No DevSync account found",
  );
  await manager.getByLabel("Invite email").fill(email("Arjun"));
  await manager.getByRole("button", { name: "Send invitation" }).click();
  await expect(manager.getByText(/Invite sent to/)).toBeVisible();
  await expect(manager.getByText("Awaiting response")).toBeVisible();
  await developer.getByRole("button", { name: /Inbox/ }).click();
  await developer.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(developer.getByLabel("Current project")).toHaveValue(/\d+/);
  const project = (await (await request(m, "/projects")).json())[0];
  const developerUser = await (await request(d, "/auth/me")).json();
  expect(
    (await request(d, `/projects/${project.id}/invitations`)).status(),
  ).toBe(403);
  expect((await request(d, `/projects/${project.id}/activity`)).status()).toBe(
    403,
  );
  expect(
    (
      await request(
        d,
        `/projects/${project.id}/invitations`,
        { email: email("Visitor") },
        "POST",
      )
    ).status(),
  ).toBe(403);
  await developer.getByRole("button", { name: "Team", exact: true }).click();
  await expect(
    developer.getByRole("heading", { name: "Project members" }),
  ).toBeVisible();
  await expect(
    developer.getByRole("button", { name: "Activity", exact: true }),
  ).toHaveCount(0);
  await expect(
    developer.getByRole("button", { name: "Send invitation", exact: true }),
  ).toHaveCount(0);
  await manager.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(
    manager.getByRole("heading", { name: "Recent activity" }),
  ).toBeVisible();
  await expect(manager.locator(".activity-row").first()).toBeVisible();
  await manager.getByRole("button", { name: "Overview", exact: true }).click();
  await manager.getByRole("button", { name: "Team", exact: true }).click();
  await expect(manager.getByText("Arjun", { exact: true })).toBeVisible();
  await expect(manager.getByText("Awaiting response")).toHaveCount(0);
  expect((await request(o, `/projects/${project.id}/dashboard`)).status()).toBe(
    403,
  );
  expect(
    (
      await request(d, `/projects/${project.id}`, { name: "Wrong" }, "PUT")
    ).status(),
  ).toBe(403);
  await manager.getByRole("button", { name: "Board", exact: true }).click();
  await manager
    .getByRole("button", { name: "New work item", exact: true })
    .click();
  await manager
    .getByLabel("Title", { exact: true })
    .fill("Build registration flow");
  await manager
    .getByLabel("Description", { exact: true })
    .fill("Connect validated registration to the API.");
  await manager
    .getByLabel("Assignee", { exact: true })
    .selectOption(String(developerUser.id));
  await manager.getByRole("button", { name: "Save work item" }).click();
  await expect(
    manager.getByRole("button", {
      name: "Build registration flow",
      exact: true,
    }),
  ).toBeVisible();
  await developer.getByRole("button", { name: "Board", exact: true }).click();
  await expect(
    developer.getByRole("button", {
      name: "Build registration flow",
      exact: true,
    }),
  ).toBeVisible();
  await developer
    .getByLabel("Status for Build registration flow")
    .selectOption("IN_PROGRESS");
  await expect(
    developer.getByLabel("Status for Build registration flow"),
  ).toHaveValue("IN_PROGRESS");
  await developer
    .getByRole("button", { name: "Build registration flow", exact: true })
    .click();
  await developer
    .getByLabel("Add a comment")
    .fill("<script>window.pwned=true</script> Ready for review.");
  await developer.getByRole("button", { name: "Post comment" }).click();
  await expect(
    developer.getByText(
      "<script>window.pwned=true</script> Ready for review.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(await developer.evaluate(() => "pwned" in window)).toBe(false);
  await developer.getByRole("button", { name: "Close dialog" }).click();
  await manager
    .getByRole("button", { name: "New work item", exact: true })
    .click();
  await manager
    .getByLabel("Title", { exact: true })
    .fill("Login rejects valid password");
  await manager.getByLabel("Type", { exact: true }).selectOption("BUG");
  await manager
    .getByLabel("Severity", { exact: true })
    .selectOption("CRITICAL");
  await manager
    .getByLabel("Reproduction steps")
    .fill("Open login and submit valid credentials.");
  await manager.getByLabel("Expected behavior").fill("Signed in");
  await manager.getByLabel("Actual behavior").fill("Error");
  await manager.getByRole("button", { name: "Save work item" }).click();
  await expect(manager.getByRole("dialog")).toHaveCount(0);
  await manager.getByRole("button", { name: "AI tools", exact: true }).click();
  await manager
    .getByRole("button", { name: "Browse bugs", exact: true })
    .click();
  await manager
    .getByRole("button", { name: /Login rejects valid password$/ })
    .click();
  await manager.getByRole("button", { name: "Suggest category" }).click();
  await expect(
    manager.getByText("Local rule-based suggestion: AUTHENTICATION"),
  ).toBeVisible();
  const before = await (
    await request(m, `/projects/${project.id}/work-items?type=BUG`)
  ).json();
  expect(before.items[0].bug.category).toBe("OTHER");
  await manager.getByRole("button", { name: "Accept category" }).click();
  await expect(
    manager.getByText("CRITICAL severity · AUTHENTICATION"),
  ).toBeVisible();
  fs.mkdirSync("../artifacts/verification", { recursive: true });
  await manager.screenshot({
    path: "../artifacts/verification/bug.png",
    fullPage: true,
  });
  await manager.getByRole("button", { name: "Close dialog" }).click();
  await manager.getByRole("button", { name: "Board", exact: true }).click();
  await manager.getByLabel("Filter type").selectOption("");
  await manager.screenshot({
    path: "../artifacts/verification/board.png",
    fullPage: true,
  });
  await manager.getByLabel("Search work items").fill("no-such-item");
  await expect(
    manager.getByText("0 matching items", { exact: false }),
  ).toBeVisible();
  await manager.getByLabel("Search work items").fill("");
  await manager.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(manager.locator(".stat").first()).toContainText("2");
  await manager.getByRole("button", { name: "AI tools", exact: true }).click();
  await manager.getByRole("button", { name: "Generate summary" }).click();
  await expect(
    manager.getByText("Local factual summary", { exact: true }),
  ).toBeVisible();
  await manager.screenshot({
    path: "../artifacts/verification/dashboard-ai.png",
    fullPage: true,
  });
  const metrics = await (
    await request(m, `/projects/${project.id}/dashboard`)
  ).json();
  expect(metrics.total).toBe(2);
  expect(metrics.statuses.IN_PROGRESS).toBe(1);
  expect(metrics.severity.CRITICAL).toBe(1);
  await manager.reload();
  await expect(manager.getByLabel("Current project")).toHaveValue(
    String(project.id),
  );
  await developer.getByRole("button", { name: /Inbox/ }).click();
  await expect(
    developer.getByText("Assigned: Build registration flow", { exact: true }),
  ).toBeVisible();
  await developer
    .getByRole("button", { name: "Mark read", exact: true })
    .first()
    .click();
  await manager.setViewportSize({ width: 390, height: 844 });
  await manager.getByRole("button", { name: "Board", exact: true }).click();
  const mobileStatus = manager.getByLabel("Status for Build registration flow");
  await expect(mobileStatus).toBeVisible();
  await expect(mobileStatus).toBeEnabled();
  await mobileStatus.focus();
  await expect(mobileStatus).toBeFocused();
  expect(
    await manager.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await manager.screenshot({
    path: "../artifacts/verification/mobile-board.png",
    fullPage: true,
  });
  expect(
    (
      await m.request.post("/api/projects", { data: { name: "CSRF" } })
    ).status(),
  ).toBe(403);
  expect(errors).toEqual([]);
  await request(m, "/auth/logout", {}, "POST");
  expect((await request(m, "/projects")).status()).toBe(401);
  fs.writeFileSync(
    "../artifacts/verification/persistence-fixture.json",
    JSON.stringify({ projectId: project.id, email: email("Arjun"), password }),
  );
  await m.close();
  await d.close();
  await o.close();
});

test.describe("project calls and developer tools", () => {
  test("three accounts exchange media, share code, and attach a review link", async ({
    browser,
  }) => {
    const baseURL = test.info().project.use.baseURL;
    const contexts = await Promise.all(
      Array.from({ length: 3 }, () =>
        browser.newContext({
          baseURL,
          permissions: [
            "microphone",
            "camera",
            "clipboard-read",
            "clipboard-write",
          ],
          viewport: { width: 1440, height: 1000 },
        }),
      ),
    );
    const [m, d, q] = contexts;
    // Keep the real WebRTC exchange while using a deterministic test screen.
    await d.addInitScript(() => {
      navigator.mediaDevices.getDisplayMedia = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 424;
        canvas.height = 240;
        const ctx = canvas.getContext("2d")!;
        const draw = () => {
          ctx.fillStyle = "#c62828";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.font = "24px sans-serif";
          ctx.fillStyle = "white";
          ctx.fillText("Synthetic screen share", 20, 42);
        };
        draw();
        const stream = canvas.captureStream(12);
        const timer = window.setInterval(() => {
          if (stream.getVideoTracks()[0].readyState === "ended")
            window.clearInterval(timer);
          else draw();
        }, 80);
        return stream;
      };
    });
    const [manager, developer, qa] = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    const browserErrors: string[] = [];
    for (const page of [manager, developer, qa])
      page.on("pageerror", (error) => browserErrors.push(error.message));

    try {
      await Promise.all([
        register(manager, "Morgan"),
        register(developer, "Devon"),
        register(qa, "Quinn"),
      ]);
      const projectResponse = await request(
        m,
        "/projects",
        { name: "Campus release workshop" },
        "POST",
      );
      expect(projectResponse.ok()).toBe(true);
      const project = await projectResponse.json();
      for (const [recipient, name] of [
        [d, "Devon"],
        [q, "Quinn"],
      ] as const) {
        const invited = await request(
          m,
          `/projects/${project.id}/invitations`,
          { email: email(name) },
          "POST",
        );
        expect(invited.ok()).toBe(true);
        const { id } = await invited.json();
        expect(
          (
            await request(
              recipient,
              `/invitations/${id}/respond`,
              { accept: true },
              "POST",
            )
          ).ok(),
        ).toBe(true);
      }
      await Promise.all([manager.reload(), developer.reload(), qa.reload()]);
      for (const page of [manager, developer, qa]) {
        await expect(page.getByLabel("Current project")).toHaveValue(
          String(project.id),
        );
      }

      const nav = (page: Page, name: string) =>
        page.getByRole("navigation").getByRole("button", { name, exact: true });
      await nav(manager, "Snippets").click();
      await manager.getByRole("button", { name: "New snippet" }).click();
      await manager.getByLabel("Snippet title").fill("Fixture database check");
      await manager.getByLabel("Language", { exact: true }).selectOption("SQL");
      await manager.getByLabel("Snippet code").fill("SELECT 1;\n");
      await manager.getByRole("button", { name: "Save snippet" }).click();
      await expect(manager.getByText("Snippet saved.")).toBeVisible();
      await nav(developer, "Snippets").click();
      await developer
        .getByRole("searchbox", { name: "Search snippets" })
        .fill("Fixture");
      await expect(
        developer.getByRole("heading", { name: "Fixture database check" }),
      ).toBeVisible();
      await developer
        .getByRole("button", { name: "Copy code", exact: true })
        .click();
      await expect(
        developer.getByText(/Copied “Fixture database check”/),
      ).toBeVisible();
      expect(
        (
          await developer.evaluate(() => navigator.clipboard.readText())
        ).replace(/\r\n/g, "\n"),
      ).toBe("SELECT 1;\n");
      await expect(
        developer.getByRole("button", { name: "Edit snippet" }),
      ).toHaveCount(0);
      await developer.screenshot({
        path: "../artifacts/verification/project-snippets.png",
        fullPage: true,
      });

      await nav(developer, "Board").click();
      await developer.getByRole("button", { name: "New work item" }).click();
      await developer
        .getByLabel("Title", { exact: true })
        .fill("Review attendee capacity validation");
      const reviewUrl = "https://github.com/example/campus-events/pull/42";
      await developer.getByLabel("Pull request URL").fill(reviewUrl);
      await developer.getByRole("button", { name: "Save work item" }).click();
      await expect(developer.getByRole("dialog")).toBeHidden();
      await nav(manager, "Board").click();
      await manager
        .getByRole("button", { name: "Review attendee capacity validation" })
        .click();
      await expect(
        manager.getByRole("link", { name: "Open pull request" }),
      ).toHaveAttribute("href", reviewUrl);
      await manager.getByRole("button", { name: "Close dialog" }).click();

      await nav(manager, "Chat").click();
      await manager
        .getByLabel("Project message", { exact: true })
        .fill("The review link is ready.");
      await manager.getByRole("button", { name: "Send message" }).click();
      await nav(qa, "Chat").click();
      await expect(qa.getByText("The review link is ready.")).toBeVisible();
      await expect(
        qa
          .locator(".chat-message")
          .filter({ hasText: "The review link is ready." })
          .getByText("Manager", { exact: true }),
      ).toBeVisible();
      for (const page of [manager, qa]) {
        await page
          .getByRole("button", { name: "Direct messages", exact: true })
          .click();
      }
      await manager.getByLabel("Find a teammate").fill("Quinn");
      await expect(
        manager.getByRole("button", { name: "Chat with Devon" }),
      ).toHaveCount(0);
      await manager.getByRole("button", { name: "Chat with Quinn" }).click();
      await qa.getByRole("button", { name: "Chat with Morgan" }).click();
      const privateNote = "I’ll send the draft to you for a first review.";
      await manager
        .getByLabel("Direct message", { exact: true })
        .fill(privateNote);
      await manager
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await expect(
        qa
          .getByRole("log", { name: "Private conversation" })
          .getByText(privateNote),
      ).toBeVisible();
      const privateThread = qa.getByRole("log", {
        name: "Private conversation",
      });
      await expect(
        privateThread.getByText("Manager", { exact: true }),
      ).toBeVisible();
      await qa
        .getByLabel("Direct message", { exact: true })
        .fill("I can review it today.");
      await qa
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await expect(
        privateThread.getByText("Developer", { exact: true }),
      ).toBeVisible();
      await nav(developer, "Chat").click();
      await developer
        .getByRole("button", { name: "Direct messages", exact: true })
        .click();
      await developer.getByRole("button", { name: "Chat with Morgan" }).click();
      await expect(
        developer.getByText("No messages in this conversation yet."),
      ).toBeVisible();
      await expect(developer.getByText(privateNote)).toHaveCount(0);
      const remote = (page: Page, participant: string) =>
        page.locator(`.call-tile[aria-label="${participant}"]`);
      const receivedAudio = (page: Page, name: string) =>
        remote(page, name)
          .locator("video")
          .evaluate(
            (video: HTMLVideoElement) =>
              (video.srcObject as MediaStream | null)
                ?.getAudioTracks()
                .some((track) => track.readyState === "live" && !track.muted) ??
              false,
          );
      const receivedVideo = (page: Page, name: string) =>
        remote(page, name)
          .locator("video")
          .evaluate(
            (video: HTMLVideoElement) => video.videoWidth > 0 && !video.paused,
          );
      const privateCall = (page: Page) =>
        page.getByRole("region", { name: "Direct call", exact: true });
      const groupCall = (page: Page) =>
        page.getByRole("region", { name: "Group call", exact: true });
      const groupChat = (page: Page) =>
        page.getByRole("button", { name: /^Group chat/ });
      await privateCall(manager)
        .getByRole("button", { name: "Start video call" })
        .click();
      await expect(
        privateCall(qa).getByText("Incoming call from Morgan"),
      ).toBeVisible();
      await expect(
        privateCall(developer).getByText("No call in progress"),
      ).toBeVisible();
      await expect(developer.getByText("Project call in progress")).toHaveCount(
        0,
      );
      await privateCall(qa)
        .getByRole("button", { name: "Join with voice" })
        .click();
      await expect(
        privateCall(manager).getByText("2 of 2 participants"),
      ).toBeVisible();
      await expect
        .poll(() => receivedVideo(qa, "Morgan"), { timeout: 15000 })
        .toBe(true);
      await expect
        .poll(() => receivedAudio(manager, "Quinn"), { timeout: 15000 })
        .toBe(true);
      const callNote = "I can see the regression in your video.";
      await qa.getByLabel("Direct message", { exact: true }).fill(callNote);
      await qa.getByLabel("Direct message", { exact: true }).press("Enter");
      await expect(
        manager
          .getByRole("log", { name: "Private conversation" })
          .getByText(callNote),
      ).toBeVisible();
      await nav(qa, "Board").click();
      await qa
        .getByRole("button", { name: "Return to direct call", exact: true })
        .click();
      await expect(remote(qa, "Morgan")).toHaveAttribute(
        "data-connection",
        "connected",
      );
      await qa.screenshot({
        path: "../artifacts/verification/direct-call.png",
        fullPage: true,
      });
      await privateCall(qa).getByRole("button", { name: "Leave call" }).click();
      await expect(
        privateCall(manager).getByRole("button", { name: "Start voice call" }),
      ).toBeEnabled();
      await groupChat(qa).click();
      const projectThread = qa.getByRole("log", {
        name: "Project conversation",
      });
      await expect(
        projectThread.getByText("The review link is ready."),
      ).toBeVisible();
      await expect(projectThread.getByText(privateNote)).toHaveCount(0);
      await expect(
        qa.getByRole("log", { name: "Private conversation" }),
      ).toHaveCount(0);
      await groupChat(manager).click();
      await groupCall(manager)
        .getByRole("button", { name: "Start voice call" })
        .click();
      await expect(
        groupCall(manager).getByRole("button", { name: "Leave call" }),
      ).toBeVisible();
      await developer
        .getByRole("button", { name: "Project call in progress" })
        .click();
      await groupCall(developer)
        .getByRole("button", { name: "Join with video" })
        .click();
      await groupCall(qa)
        .getByRole("button", { name: "Join with voice" })
        .click();
      await expect(
        groupCall(manager).getByText("3 of 4 participants"),
      ).toBeVisible();
      await expect(remote(manager, "Devon")).toHaveAttribute(
        "data-connection",
        "connected",
        { timeout: 20000 },
      );
      await expect(remote(qa, "Morgan")).toHaveAttribute(
        "data-connection",
        "connected",
        { timeout: 20000 },
      );
      await expect
        .poll(() => receivedAudio(manager, "Devon"), { timeout: 15000 })
        .toBe(true);
      await expect
        .poll(() => receivedAudio(developer, "Morgan"), { timeout: 15000 })
        .toBe(true);
      await expect
        .poll(() => receivedVideo(qa, "Devon"), { timeout: 15000 })
        .toBe(true);
      await manager
        .getByLabel("Project message", { exact: true })
        .fill("Logging the decision while we talk.");
      await manager
        .getByLabel("Project message", { exact: true })
        .press("Enter");
      await expect(
        manager.getByText("Logging the decision while we talk."),
      ).toBeVisible();
      await expect(remote(manager, "Devon")).toHaveAttribute(
        "data-connection",
        "connected",
      );
      await manager
        .getByRole("button", { name: "Mute microphone", exact: true })
        .click();
      await expect(
        remote(developer, "Morgan").getByText("Muted"),
      ).toBeVisible();
      await manager
        .getByRole("button", { name: "Unmute microphone", exact: true })
        .click();
      await expect(
        remote(developer, "Morgan").getByText("Connected"),
      ).toBeVisible();
      await developer
        .getByRole("button", { name: "Turn camera off", exact: true })
        .click();
      await expect(remote(manager, "Devon").locator("video")).toHaveClass(
        "audio-only",
      );
      await developer
        .getByRole("button", { name: "Share screen", exact: true })
        .click();
      await expect(
        remote(manager, "Devon").getByText("Sharing screen"),
      ).toBeVisible();
      await expect
        .poll(
          async () =>
            remote(manager, "Devon")
              .locator("video")
              .evaluate((video: HTMLVideoElement) => {
                if (!video.videoWidth) return false;
                const canvas = document.createElement("canvas");
                canvas.width = canvas.height = 1;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(video, 0, 0, 1, 1);
                const [red, green, blue] = ctx.getImageData(0, 0, 1, 1).data;
                return red > 150 && green < 100 && blue < 100;
              }),
          { timeout: 15000 },
        )
        .toBe(true);
      await manager.screenshot({
        path: "../artifacts/verification/project-call.png",
        fullPage: true,
      });
      await developer
        .getByRole("button", { name: "Stop sharing", exact: true })
        .click();
      await expect(remote(manager, "Devon").locator("video")).toHaveClass(
        "audio-only",
      );
      await nav(developer, "Board").click();
      await developer.getByRole("button", { name: "Return to call" }).click();
      await expect(remote(developer, "Morgan")).toHaveAttribute(
        "data-connection",
        "connected",
      );
      await developer.getByRole("button", { name: "Leave call" }).click();
      await expect(remote(manager, "Devon")).toHaveCount(0);
      await qa.getByRole("button", { name: "Leave call" }).click();
      await manager.getByRole("button", { name: "Leave call" }).click();
      await expect(manager.getByText("No call in progress")).toBeVisible();
      expect(browserErrors).toEqual([]);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
});
