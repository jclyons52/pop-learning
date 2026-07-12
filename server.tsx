/** @jsx jsx */
/** @jsxFrag Fragment */
import { Hono } from "npm:hono";
import { serveStatic } from "npm:hono/deno";
import { getCookie, setCookie, deleteCookie } from "npm:hono/cookie";
import { jsx, Fragment } from "npm:hono/jsx";

const app = new Hono();
const kv = await Deno.openKv();

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
          <a href="/" style="color: var(--ink);">Back to Game</a>
        </header>
        {props.children}
      </div>
    </body>
  </html>
);

// --- Auth Middleware ---
const authMiddleware = async (c: any, next: any) => {
  const session = getCookie(c, "session_id");
  if (!session || session !== "demo-session") {
    return c.redirect("/login");
  }
  await next();
};

// --- Routes ---

app.get("/login", (c) => {
  return c.html(
    <Layout title="Login">
      <div class="dashboard-card">
        <h2>Parent / Teacher Login</h2>
        <p>Use password <strong>demo</strong> to login.</p>
        <form method="post" action="/login">
          <input type="password" name="password" placeholder="Password" />
          <button type="submit">Login</button>
        </form>
      </div>
    </Layout>
  );
});

app.post("/login", async (c) => {
  const body = await c.req.parseBody();
  if (body.password === "demo") {
    setCookie(c, "session_id", "demo-session");
    return c.redirect("/dashboard");
  }
  return c.redirect("/login?error=1");
});

app.get("/dashboard", authMiddleware, async (c) => {
  // Fetch students for the demo parent
  const parentId = "parent-1";
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
                <span>Link Code: <span class="link-code">{s.value.code}</span></span>
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
    </Layout>
  );
});

app.post("/dashboard/student", authMiddleware, async (c) => {
  const body = await c.req.parseBody();
  const name = body.name;
  const parentId = "parent-1";
  const studentId = crypto.randomUUID();
  const code = Math.random().toString(36).substring(2, 6).toUpperCase(); // e.g. "ABCD"
  
  await kv.set(["students", parentId, studentId], { id: studentId, name, code, parentId });
  await kv.set(["link_codes", code], studentId);
  
  return c.redirect("/dashboard");
});

app.get("/dashboard/student/:id", authMiddleware, async (c) => {
  const studentId = c.req.param("id");
  const parentId = "parent-1";
  
  const [studentRes, progressRes] = await Promise.all([
    kv.get(["students", parentId, studentId]),
    kv.get(["progress", studentId])
  ]);
  
  const student = (studentRes.value as any) || { name: "Unknown Student" };
  const pData = progressRes.value || {};
  
  return c.html(
    <Layout title={`${student.name}'s Progress`}>
      <script src="/shared/pop.js"></script>
      <script src="/shared/parent-ui.js"></script>
      <script dangerouslySetInnerHTML={{ __html: `window.STUDENT_PROGRESS = ${JSON.stringify(pData)};` }}></script>
      
      <div style="margin-bottom: 2rem;">
        <a href="/dashboard" style="text-decoration: none; font-weight: bold; color: var(--ink-soft);">← Back to Dashboard</a>
        <h2 style="margin-top: 1rem; font-size: 2rem;">{student.name}'s Progress</h2>
      </div>
      
      <div id="progress-root"></div>
      
      <script dangerouslySetInnerHTML={{ __html: `Pop.renderParentUI(window.STUDENT_PROGRESS, document.getElementById("progress-root"));` }}></script>
    </Layout>
  );
});

// --- API for Device Linking & Syncing ---

app.post("/api/link", async (c) => {
  const { code } = await c.req.json();
  const studentIdRes = await kv.get(["link_codes", code.toUpperCase()]);
  if (!studentIdRes.value) {
    return c.json({ error: "Invalid link code" }, 400);
  }
  return c.json({ studentId: studentIdRes.value });
});

app.post("/api/progress", async (c) => {
  const studentId = c.req.header("X-Student-ID");
  if (!studentId) return c.json({ error: "Unlinked device" }, 400);
  
  const body = await c.req.json();
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
