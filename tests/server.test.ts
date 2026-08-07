import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import app from "../server.tsx";

// --- helpers ---

let signupCounter = 0;
const RUN_ID = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
async function createUser(displayName: string, email: string, password: string, cookieFile: string) {
  const res = await app.request(
    new Request("http://localhost/signup", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        displayName,
        email,
        password,
        confirm: password,
      }).toString(),
    }),
  );
  return res;
}

function cookieHeader(setCookie: string | null): string {
  const m = setCookie?.match(/pop_session=([^;]+)/);
  return `pop_session=${m![1]}`;
}

function uniqueEmail(seed: string): string {
  signupCounter += 1;
  return `${seed}-${signupCounter}-${RUN_ID}@example.com`;
}

async function signupAndLogin(seed: string): Promise<{ cookie: string; email: string; password: string }> {
  const email = uniqueEmail(seed);
  const password = "test-password-123";
  const res = await createUser(seed, email, password, "");
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "/dashboard");
  const cookie = cookieHeader(res.headers.get("set-cookie"));
  return { cookie, email, password };
}

// --- auth page rendering ---

Deno.test("GET /login returns login page", async () => {
  const res = await app.request("/login");
  assertEquals(res.status, 200);
  const text = await res.text();
  assertStringIncludes(text, "Parent / Teacher Login");
  assertStringIncludes(text, "Create an account");
});

Deno.test("GET /signup returns signup page", async () => {
  const res = await app.request("/signup");
  assertEquals(res.status, 200);
  const text = await res.text();
  assertStringIncludes(text, "Create an account");
  assertStringIncludes(text, "Confirm password");
});

// --- signup validation ---

Deno.test("POST /signup rejects a too-short password", async () => {
  const res = await app.request(
    new Request("http://localhost/signup", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        displayName: "Sam",
        email: uniqueEmail("shortsam"),
        password: "short",
        confirm: "short",
      }).toString(),
    }),
  );
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "/signup?error=1");
});

Deno.test("POST /signup rejects mismatched passwords", async () => {
  const res = await app.request(
    new Request("http://localhost/signup", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        displayName: "Sam",
        email: uniqueEmail("mismatchsam"),
        password: "password-123",
        confirm: "password-999",
      }).toString(),
    }),
  );
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "/signup?error=1");
});

Deno.test("POST /signup rejects an invalid email", async () => {
  const res = await app.request(
    new Request("http://localhost/signup", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        displayName: "Sam",
        email: "not-an-email",
        password: "password-123",
        confirm: "password-123",
      }).toString(),
    }),
  );
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "/signup?error=1");
});

Deno.test("POST /signup with valid details creates an account and logs in", async () => {
  const res = await createUser("Ruby Parent", uniqueEmail("ruby"), "password-123", "signup_valid_cookie.txt");
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "/dashboard");
  const setCookie = res.headers.get("set-cookie")!;
  assertStringIncludes(setCookie, "pop_session=");
  assertStringIncludes(setCookie, "HttpOnly");
});

Deno.test("POST /signup rejects a duplicate email", async () => {
  const email = uniqueEmail("dupesam");
  await createUser("Sam One", email, "password-123", "");
  const res = await createUser("Sam Two", email, "password-123", "");
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "/signup?error=1");
});

// --- login / logout ---

Deno.test("POST /login with correct credentials logs in", async () => {
  const { email, password } = await signupAndLogin("loginsam");
  const res = await app.request(
    new Request("http://localhost/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email, password }).toString(),
    }),
  );
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "/dashboard");
  assertStringIncludes(res.headers.get("set-cookie")!, "pop_session=");
});

Deno.test("POST /login with wrong password redirects to error", async () => {
  const { email } = await signupAndLogin("wrongpwsam");
  const res = await app.request(
    new Request("http://localhost/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email, password: "wrong-password" }).toString(),
    }),
  );
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "/login?error=1");
});

Deno.test("GET /dashboard redirects if not logged in", async () => {
  const res = await app.request("/dashboard");
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "/login");
});

Deno.test("GET /dashboard redirects if a forged/guessable session is used", async () => {
  const res = await app.request(
    new Request("http://localhost/dashboard", {
      headers: { "Cookie": "pop_session=someforgedtoken" },
    }),
  );
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "/login");
});

Deno.test("POST /logout clears the session, then dashboard is protected again", async () => {
  const { cookie } = await signupAndLogin("logoutam");
  const out = await app.request(
    new Request("http://localhost/logout", { method: "POST", headers: { "Cookie": cookie } }),
  );
  assertEquals(out.status, 302);
  assertEquals(out.headers.get("location"), "/login");
  const dash = await app.request(
    new Request("http://localhost/dashboard", { headers: { "Cookie": cookie } }),
  );
  assertEquals(dash.status, 302);
});

// --- full per-user flow ---

Deno.test("Dashboard integration flow: Create student -> Link -> Sync progress", async () => {
  const { cookie } = await signupAndLogin("integrationsam");

  // 1. Create student
  const createStudentReq = new Request("http://localhost/dashboard/student", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookie,
    },
    body: "name=IntegrationTestStudent",
  });
  const createRes = await app.request(createStudentReq);
  assertEquals(createRes.status, 302);
  assertEquals(createRes.headers.get("location"), "/dashboard");

  // 2. Fetch dashboard to find the link code
  const dashReq = new Request("http://localhost/dashboard", { headers: { "Cookie": cookie } });
  const dashRes = await app.request(dashReq);
  const dashHtml = await dashRes.text();
  const matches = [...dashHtml.matchAll(/<span class="link-code">([A-Z0-9]{4})<\/span>/g)];
  const linkCode = matches[matches.length - 1][1];

  // 3. Link device via /api/link
  const linkReq = new Request("http://localhost/api/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: linkCode }),
  });
  const linkRes = await app.request(linkReq);
  assertEquals(linkRes.status, 200);
  const linkData = await linkRes.json();
  const studentId = linkData.studentId;

  // 4. Sync progress via /api/progress
  const progressReq = new Request("http://localhost/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Student-ID": studentId },
    body: JSON.stringify({ "test-game": { "test-item": { seen: 1, right: 1 } } }),
  });
  const progressRes = await app.request(progressReq);
  assertEquals(progressRes.status, 200);
  assertEquals((await progressRes.json()).success, true);

  // 5. Verify progress appears in the student dashboard
  const studentDashReq = new Request(
    `http://localhost/dashboard/student/${studentId}`,
    { headers: { "Cookie": cookie } },
  );
  const studentDashRes = await app.request(studentDashReq);
  assertStringIncludes(await studentDashRes.text(), "test-game");
});

Deno.test("A user cannot view another user's student (404)", async () => {
  const { cookie: samCookie } = await signupAndLogin("isolation_sam");
  // sam creates a student
  await app.request(
    new Request("http://localhost/dashboard/student", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": samCookie },
      body: "name=PrivateKid",
    }),
  );
  const dashHtml = await (await app.request(
    new Request("http://localhost/dashboard", { headers: { "Cookie": samCookie } }),
  )).text();
  const linkCode = [...dashHtml.matchAll(/<span class="link-code">([A-Z0-9]{4})<\/span>/g)].pop()![1];
  const studentId = (await (await app.request(
    new Request("http://localhost/api/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: linkCode }),
    }),
  )).json()).studentId;

  // second user tries to view it
  const { cookie: otherCookie } = await signupAndLogin("isolation_other");
  const res = await app.request(
    new Request(`http://localhost/dashboard/student/${studentId}`, {
      headers: { "Cookie": otherCookie },
    }),
  );
  assertEquals(res.status, 404);
});

Deno.test("POST /dashboard/student rejects invalid names", async () => {
  const { cookie } = await signupAndLogin("badnamesam");
  for (const name of ["<script>alert(1)</script>", "", "   "]) {
    const req = new Request("http://localhost/dashboard/student", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": cookie },
      body: `name=${encodeURIComponent(name)}`,
    });
    const res = await app.request(req);
    assertEquals(res.status, 400);
  }
});

// --- JSON API edge cases (no auth required on these endpoints) ---

Deno.test("POST /api/link with malformed/empty JSON returns 400 (not 500)", async () => {
  for (const body of ["", "not-json", "[]", "42"]) {
    const req = new Request("http://localhost/api/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const res = await app.request(req);
    assertEquals(res.status, 400);
  }
});

Deno.test("POST /api/link rejects invalid code format", async () => {
  const res = await app.request(
    new Request("http://localhost/api/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "ab" }),
    }),
  );
  assertEquals(res.status, 400);
});

Deno.test("POST /api/link with unknown code returns 400", async () => {
  const res = await app.request(
    new Request("http://localhost/api/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "ZZZZ" }),
    }),
  );
  assertEquals(res.status, 400);
});

Deno.test("POST /api/progress with malformed JSON returns 400", async () => {
  const res = await app.request(
    new Request("http://localhost/api/progress", {
      method: "POST",
      headers: { "X-Student-ID": "xyz", "Content-Type": "application/json" },
      body: "not-json",
    }),
  );
  assertEquals(res.status, 400);
});

Deno.test("POST /api/progress rejects non-object payloads", async () => {
  for (const payload of ["[1,2,3]", '"hello"', "null"]) {
    const res = await app.request(
      new Request("http://localhost/api/progress", {
        method: "POST",
        headers: { "X-Student-ID": "xyz", "Content-Type": "application/json" },
        body: payload,
      }),
    );
    assertEquals(res.status, 400);
  }
});

Deno.test("POST /api/progress rejects oversized payloads (413)", async () => {
  const big = JSON.stringify({ a: "x".repeat(500 * 1024) });
  const res = await app.request(
    new Request("http://localhost/api/progress", {
      method: "POST",
      headers: { "X-Student-ID": "xyz", "Content-Type": "application/json" },
      body: big,
    }),
  );
  assertEquals(res.status, 413);
});
