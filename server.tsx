/** @jsx jsx */
/** @jsxFrag Fragment */
import { Hono } from "npm:hono";
import { HTTPException } from "npm:hono/http-exception";
import { serveStatic } from "npm:hono/deno";
import { deleteCookie, getCookie, setCookie } from "npm:hono/cookie";
import { Fragment, jsx } from "npm:hono/jsx";

const app = new Hono();
const kv = await Deno.openKv();

// Read the parent password from the environment. In local dev (no env set) it
// falls back to "demo" so things keep working; on Deno Deploy set POP_PASSWORD
// to a real secret. The parent id likewise defaults for dev.
const PASSWORD = Deno.env.get("POP_PASSWORD") || (Deno.env.get("DENO_DEPLOYMENT_ID") ? "" : "demo");
const PARENT_ID = Deno.env.get("POP_PARENT_ID") || "parent-1";

// Basic Layout Component
const Layout = (props: { title: string; children?: any }) => (
  <html>
    <head>
      <title>{props.title} - Pop Learning</title>
      <link rel="stylesheet" href="/shared/pop.css" />
      <link rel="stylesheet" href="/shared/parent-ui.css" />
      <style>
        {`
          .dashboard-container { font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; width: 100%; box-sizing: border-box; }
          .dashboard-card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 2rem; color: #333; }
          input, button { padding: 0.5rem 1rem; font-size: 1rem; border-radius: 8px; border: 1px solid #ccc; margin-right: 1rem; }
          button { background: var(--c1, #FF6B6B); color: white; border: none; cursor: pointer; font-weight: bold;}
          button:hover { filter: brightness(1.1); }
          .link-code { font-family: monospace; font-size: 1.5rem; background: #eee; padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 2px;}
          ul { list-style: none; padding: 0; }
        `}
      </style>
    </head>
    <body style="background: var(--bg, #FFFBEB); display: block;">
      <div class="dashboard-container">
        <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; color: #333;">
          <h1 style="margin: 0;">🎈 Pop Learning Dashboard</h1>
          <div style="display: flex; gap: 1rem; align-items: center;">
            <a href="/" style="color: var(--ink);">Back to Game</a>
            <form method="post" action="/logout" style="margin: 0;">
              <button
                type="submit"
                style="background: var(--c4, #999); padding: 0.3rem 0.8rem; font-size: 0.85rem;"
              >
                Log out
              </button>
            </form>
          </div>
        </header>
        {props.children}
      </div>
    </body>
  </html>
);

// --- Auth ---
// Sessions are random tokens stored in KV (never a guessable fixed value), so
// a client can't just set session_id themselves. Cookie is hardened and
// HttpOnly, so browser JS can't read it either.
const SESSION_COOKIE = "pop_session";
const IS_PRODUCTION = !!Deno.env.get("DENO_DEPLOYMENT_ID");
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const authMiddleware = async (c: any, next: any) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.redirect("/login");
  const session = await kv.get(["sessions", token]);
  if (!session.value || (session.value as any).parentId !== PARENT_ID) {
    return c.redirect("/login");
  }
  await next();
};

const setSession = async (c: any) => {
  const token = crypto.randomUUID();
  await kv.set(["sessions", token], { parentId: PARENT_ID, createdAt: Date.now() }, {
    expireIn: SESSION_TTL_MS,
  });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: IS_PRODUCTION,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return token;
};

const clearSession = async (c: any) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await kv.delete(["sessions", token]);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
  }
};

// --- Global error handler: never leak stack traces to clients ---
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// --- Security headers: applied to every response ---
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "same-origin");
  if (IS_PRODUCTION) {
    c.res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
});

// --- Routes ---

app.get("/login", (c) => {
  return c.html(
    <Layout title="Login">
      <div class="dashboard-card">
        <h2>Parent / Teacher Login</h2>
        {PASSWORD === ""
          ? <p style="color: #c00;">No POP_PASSWORD env var set — login disabled.</p>
          : <p>Enter the parent password to continue.</p>}
        <form method="post" action="/login">
          <input type="password" name="password" placeholder="Password" />
          <button type="submit">Login</button>
        </form>
      </div>
    </Layout>,
  );
});

app.post("/login", async (c) => {
  const body = await c.req.parseBody();
  if (PASSWORD !== "" && body.password === PASSWORD) {
    await setSession(c);
    return c.redirect("/dashboard");
  }
  return c.redirect("/login?error=1");
});

app.post("/logout", authMiddleware, async (c) => {
  await clearSession(c);
  return c.redirect("/login");
});

app.get("/dashboard", authMiddleware, async (c) => {
  // Fetch students for the demo parent
  const parentId = PARENT_ID;
  const studentsIter = kv.list({ prefix: ["students", parentId] });
  const students: any[] = [];
  for await (const res of studentsIter) students.push(res);

  return c.html(
    <Layout title="Dashboard">
      <div class="dashboard-card">
        <h2>Your Students</h2>
        {students.length === 0 ? <p>No students added yet.</p> : (
          <ul>
            {students.map((s) => (
              <li style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem;">
                <strong style="font-size: 1.2rem; min-width: 100px;">{s.value.name}</strong>
                <span>
                  Link Code: <span class="link-code">{s.value.code}</span>
                </span>
                <a href={`/dashboard/student/${s.value.id}`} style="margin-left: auto;">View Progress</a>
              </li>
            ))}
          </ul>
        )}
        <hr style="margin: 2rem 0; border: none; border-top: 1px solid #eee;" />
        <h3>Add Student</h3>
        <form method="post" action="/dashboard/student">
          <input type="text" name="name" placeholder="Student Name" required />
          <button type="submit">Add Student</button>
        </form>
      </div>
    </Layout>,
  );
});

app.post("/dashboard/student", authMiddleware, async (c) => {
  const body = await c.req.parseBody();
  const name = String(body.name || "").trim();
  if (!NAME_RE.test(name)) {
    throw new HTTPException(400, { message: "Invalid student name" });
  }
  const parentId = PARENT_ID;
  const studentId = crypto.randomUUID();

  // Generate a unique 4-char link code (retry on collision).
  let code = "";
  for (let i = 0; i < 10; i++) {
    const candidate = Math.random().toString(36).substring(2, 6).toUpperCase();
    if (!(await kv.get(["link_codes", candidate])).value) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new HTTPException(500, { message: "Could not allocate a link code" });

  await kv.set(["students", parentId, studentId], { id: studentId, name, code, parentId });
  await kv.set(["link_codes", code], studentId);

  return c.redirect("/dashboard");
});

app.get("/dashboard/student/:id", authMiddleware, async (c) => {
  const studentId = c.req.param("id");
  const parentId = PARENT_ID;

  const [studentRes, progressRes] = await Promise.all([
    kv.get(["students", parentId, studentId]),
    kv.get(["progress", studentId]),
  ]);

  const student = (studentRes.value as any) || { name: "Unknown Student" };
  const pData = progressRes.value || {};
  const progressJson = JSON.stringify(pData)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  return c.html(
    <Layout title={`${student.name}'s Progress`}>
      <script src="/shared/pop.js"></script>
      <script src="/shared/parent-ui.js"></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.STUDENT_PROGRESS = ${progressJson};`,
        }}
      >
      </script>

      <div style="margin-bottom: 2rem;">
        <a href="/dashboard" style="text-decoration: none; font-weight: bold; color: var(--ink-soft);">
          ← Back to Dashboard
        </a>
        <h2 style="margin-top: 1rem; font-size: 2rem;">{student.name}'s Progress</h2>
      </div>

      <div id="progress-root"></div>

      <script
        dangerouslySetInnerHTML={{
          __html: `Pop.renderParentUI(window.STUDENT_PROGRESS, document.getElementById("progress-root"));`,
        }}
      >
      </script>
    </Layout>,
  );
});

// --- API for Device Linking & Syncing ---

// Parse a JSON request body, returning 400 (not 500) on malformed input.
async function readJson(c: any, { maxBytes = 64 * 1024 } = {}) {
  const body = await c.req.text();
  if (body.length > maxBytes) {
    throw new HTTPException(413, { message: "Payload too large" });
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }
}

const NAME_RE = /^[a-zA-Z0-9 _.'-]{1,60}$/;

app.post("/api/link", async (c) => {
  const { code } = await readJson(c);
  if (typeof code !== "string" || !/^[A-Z0-9]{4,6}$/.test(code)) {
    throw new HTTPException(400, { message: "Invalid link code" });
  }
  const studentIdRes = await kv.get(["link_codes", code.toUpperCase()]);
  if (!studentIdRes.value) {
    throw new HTTPException(400, { message: "Invalid link code" });
  }
  return c.json({ studentId: studentIdRes.value });
});

app.post("/api/progress", async (c) => {
  const studentId = c.req.header("X-Student-ID");
  if (!studentId) return c.json({ error: "Unlinked device" }, 400);

  const body = await readJson(c, { maxBytes: 256 * 1024 });
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HTTPException(400, { message: "Progress must be an object" });
  }
  await kv.set(["progress", studentId], body);
  return c.json({ success: true });
});

// --- Static Files ---
app.use("/*", serveStatic({ root: "./" }));
app.get("/", serveStatic({ path: "./index.html" }));

export default app;
if (import.meta.main) {
  Deno.serve(app.fetch);
}
