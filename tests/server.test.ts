import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import app from "../server.tsx";

// Log in with the dev-demo password and return a Cookie header for the
// issued session token (a real random session, matching production flow).
async function loginCookie(): Promise<string> {
  const res = await app.request(
    new Request("http://localhost/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "password=demo",
    }),
  );
  const setCookie = res.headers.get("set-cookie")!;
  const match = setCookie.match(/pop_session=([^;]+)/);
  assertStringIncludes(setCookie, "pop_session=");
  return `pop_session=${match![1]}`;
}

Deno.test("GET /login returns login page", async () => {
  const res = await app.request("/login");
  assertEquals(res.status, 200);
  const text = await res.text();
  assertStringIncludes(text, "Parent / Teacher Login");
});

Deno.test("POST /login with correct password sets a random session cookie and redirects", async () => {
  const req = new Request("http://localhost/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "password=demo",
  });
  const res = await app.request(req);
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "/dashboard");
  const setCookie = res.headers.get("set-cookie")!;
  assertStringIncludes(setCookie, "pop_session=");
  assertStringIncludes(setCookie, "HttpOnly");
  const token = setCookie.match(/pop_session=([^;]+)/)![1];
  assertEquals(token.length > 0, true);
});

Deno.test("POST /login with incorrect password redirects to error", async () => {
  const req = new Request("http://localhost/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "password=wrong",
  });
  const res = await app.request(req);
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
    new Request("http://localhost/dashboard", { headers: { "Cookie": "pop_session=demo-session" } }),
  );
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "/login");
});

Deno.test("POST /logout clears the session, then dashboard is protected again", async () => {
  const cookie = await loginCookie();
  const out = await app.request(
    new Request("http://localhost/logout", { method: "POST", headers: { "Cookie": cookie } }),
  );
  assertEquals(out.status, 302);
  assertEquals(out.headers.get("location"), "/login");
  // Original token should now be invalid.
  const dash = await app.request(
    new Request("http://localhost/dashboard", { headers: { "Cookie": cookie } }),
  );
  assertEquals(dash.status, 302);
});

Deno.test("Dashboard integration flow: Create student -> Link -> Sync progress", async () => {
  const cookie = await loginCookie();

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

  // 2. Fetch dashboard to find the link code (hacky but works for integration)
  const dashReq = new Request("http://localhost/dashboard", {
    headers: { "Cookie": cookie },
  });
  const dashRes = await app.request(dashReq);
  const dashHtml = await dashRes.text();

  // Extract link code using regex: <span class="link-code">XXXX</span>
  // Since we might have multiple students, let's just grab the last one created
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
    headers: {
      "Content-Type": "application/json",
      "X-Student-ID": studentId,
    },
    body: JSON.stringify({ "test-game": { "test-item": { seen: 1, right: 1 } } }),
  });
  const progressRes = await app.request(progressReq);
  assertEquals(progressRes.status, 200);
  const progressData = await progressRes.json();
  assertEquals(progressData.success, true);

  // 5. Verify progress in dashboard
  const studentDashReq = new Request(`http://localhost/dashboard/student/${studentId}`, {
    headers: { "Cookie": cookie },
  });
  const studentDashRes = await app.request(studentDashReq);
  const studentDashHtml = await studentDashRes.text();
  assertStringIncludes(studentDashHtml, "test-game");
});

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
  const req = new Request("http://localhost/api/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "ab" }),
  });
  const res = await app.request(req);
  assertEquals(res.status, 400);
});

Deno.test("POST /api/link with unknown code returns 400", async () => {
  const req = new Request("http://localhost/api/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "ZZZZ" }),
  });
  const res = await app.request(req);
  assertEquals(res.status, 400);
});

Deno.test("POST /api/progress with malformed JSON returns 400", async () => {
  const req = new Request("http://localhost/api/progress", {
    method: "POST",
    headers: { "X-Student-ID": "xyz", "Content-Type": "application/json" },
    body: "not-json",
  });
  const res = await app.request(req);
  assertEquals(res.status, 400);
});

Deno.test("POST /api/progress rejects non-object payloads", async () => {
  for (const payload of ["[1,2,3]", '"hello"', "null"]) {
    const req = new Request("http://localhost/api/progress", {
      method: "POST",
      headers: { "X-Student-ID": "xyz", "Content-Type": "application/json" },
      body: payload,
    });
    const res = await app.request(req);
    assertEquals(res.status, 400);
  }
});

Deno.test("POST /api/progress rejects oversized payloads (413)", async () => {
  const big = JSON.stringify({ a: "x".repeat(500 * 1024) });
  const req = new Request("http://localhost/api/progress", {
    method: "POST",
    headers: { "X-Student-ID": "xyz", "Content-Type": "application/json" },
    body: big,
  });
  const res = await app.request(req);
  assertEquals(res.status, 413);
});

Deno.test("POST /dashboard/student rejects invalid names", async () => {
  const cookie = await loginCookie();
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
