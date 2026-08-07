/** @jsx jsx */
/** @jsxFrag Fragment */
import { Hono } from "npm:hono";
import { HTTPException } from "npm:hono/http-exception";
import { serveStatic } from "npm:hono/deno";
import { deleteCookie, getCookie, setCookie } from "npm:hono/cookie";
import { Fragment, jsx } from "npm:hono/jsx";

type AppVariables = { userId: string };
const app = new Hono<{ Variables: AppVariables }>();
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
          .auth-form { display: flex; flex-direction: column; gap: 0.9rem; }
          .auth-form label { display: flex; flex-direction: column; gap: 0.35rem; font-weight: 600; font-size: 0.9rem; color: #444; }
          .auth-form input { padding: 0.7rem 0.85rem; font-size: 1rem; border-radius: 10px; border: 1px solid #cbd0d8; width: 100%; box-sizing: border-box; }
          .auth-form input:focus { outline: 3px solid #a5d8ff; outline-offset: 0; border-color: #4dabf7; }
          .auth-form button { margin: 0; padding: 0.8rem 1rem; border-radius: 10px; width: 100%; font-size: 1.05rem; }
          .auth-sub { color: #666; margin-top: 0; }
          .auth-alt { margin: 1.2rem 0 0; text-align: center; font-size: 0.92rem; color: #555; }
          .auth-alt a { color: var(--c2, #4dabf7); font-weight: 700; }
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
const PBKDF2_ITERATIONS = 100_000;

const te = new TextEncoder();

// --- Password hashing (WebCrypto PBKDF2; no external deps) ---
async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: te.encode(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time string compare to avoid timing side-channels.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// --- User + session helpers ---
type User = {
  userId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
};

async function userById(userId: string): Promise<User | null> {
  return (await kv.get<User>(["users", userId])).value || null;
}

async function userByEmail(email: string): Promise<User | null> {
  const userId = (await kv.get<string>(["users_by_email", email])).value;
  if (!userId) return null;
  return userById(userId);
}

const authMiddleware = async (c: any, next: any) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.redirect("/login");
  const session = await kv.get<{ userId: string }>(["sessions", token]);
  if (!session.value || !(await userById(session.value.userId))) {
    return c.redirect("/login");
  }
  c.set("userId", session.value.userId);
  await next();
};

const setSession = async (c: any, userId: string) => {
  const token = crypto.randomUUID();
  await kv.set(["sessions", token], { userId, createdAt: Date.now() }, {
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

// --- Auth pages ---
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AuthLayout = (props: { title: string; error?: boolean; children?: any }) => (
  <Layout title={props.title}>
    <div class="dashboard-card" style="max-width:460px; margin:0 auto;">
      {props.error
        ? (
          <p style="color:#c00; font-weight:600;">
            That didn't work — please check your details and try again.
          </p>
        )
        : null}
      {props.children}
    </div>
  </Layout>
);

app.get("/login", (c) => {
  const error = c.req.query("error");
  return c.html(
    <AuthLayout title="Login" error={!!error}>
      <h2>Parent / Teacher Login</h2>
      <form method="post" action="/login" class="auth-form">
        <label>
          Email<input type="email" name="email" placeholder="you@school.edu" required autocomplete="email" />
        </label>
        <label>
          Password<input
            type="password"
            name="password"
            placeholder="Your password"
            required
            autocomplete="current-password"
          />
        </label>
        <button type="submit">Log in</button>
      </form>
      <p class="auth-alt">
        New here? <a href="/signup">Create an account</a>
      </p>
    </AuthLayout>,
  );
});

app.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const user = await userByEmail(email);
  if (!user) return c.redirect("/login?error=1");
  const hash = await hashPassword(password, user.salt);
  if (!safeEqual(hash, user.passwordHash)) return c.redirect("/login?error=1");
  await setSession(c, user.userId);
  return c.redirect("/dashboard");
});

app.get("/signup", (c) => {
  const error = c.req.query("error");
  return c.html(
    <AuthLayout title="Sign up" error={!!error}>
      <h2>Create an account</h2>
      <p class="auth-sub">Track your child's or class's progress across devices.</p>
      <form method="post" action="/signup" class="auth-form">
        <label>
          Your name<input
            type="text"
            name="displayName"
            placeholder="e.g. Sam Jones"
            required
            maxlength="60"
            autocomplete="name"
          />
        </label>
        <label>
          Email<input type="email" name="email" placeholder="you@school.edu" required autocomplete="email" />
        </label>
        <label>
          Password<input
            type="password"
            name="password"
            placeholder="At least 8 characters"
            required
            minlength="8"
            autocomplete="new-password"
          />
        </label>
        <label>
          Confirm password<input
            type="password"
            name="confirm"
            placeholder="Repeat password"
            required
            minlength="8"
            autocomplete="new-password"
          />
        </label>
        <button type="submit">Create account</button>
      </form>
      <p class="auth-alt">
        Already have an account? <a href="/login">Log in</a>
      </p>
    </AuthLayout>,
  );
});

app.post("/signup", async (c) => {
  const body = await c.req.parseBody();
  const displayName = String(body.displayName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const confirm = String(body.confirm || "");

  if (!displayName) return c.redirect("/signup?error=1");
  if (!EMAIL_RE.test(email) || email.length > 120) return c.redirect("/signup?error=1");
  if (password.length < 8 || password.length > 200) return c.redirect("/signup?error=1");
  if (password !== confirm) return c.redirect("/signup?error=1");

  if (await userByEmail(email)) return c.redirect("/signup?error=1");

  const userId = crypto.randomUUID();
  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const user: User = { userId, email, displayName, salt, passwordHash, createdAt: Date.now() };

  // Guard against a race where two sign-ups use the same email (atomic check).
  const emailRes = await kv
    .atomic()
    .check({ key: ["users_by_email", email], versionstamp: null })
    .set(["users_by_email", email], userId)
    .commit();
  if (!emailRes.ok) return c.redirect("/signup?error=1");
  await kv.set(["users", userId], user);

  await setSession(c, userId);
  return c.redirect("/dashboard");
});

app.post("/logout", authMiddleware, async (c) => {
  await clearSession(c);
  return c.redirect("/login");
});

app.get("/dashboard", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const studentsIter = kv.list({ prefix: ["students", userId] });
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
  const parentId = c.get("userId");
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
  const parentId = c.get("userId");

  const [studentRes, progressRes] = await Promise.all([
    kv.get(["students", parentId, studentId]),
    kv.get(["progress", studentId]),
  ]);

  const student = studentRes.value as any;
  if (!student) throw new HTTPException(404, { message: "Student not found" });
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
