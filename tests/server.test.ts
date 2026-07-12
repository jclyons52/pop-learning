import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import app from "../server.tsx";

Deno.test("GET /login returns login page", async () => {
  const res = await app.request("/login");
  assertEquals(res.status, 200);
  const text = await res.text();
  assertStringIncludes(text, "Parent / Teacher Login");
});

Deno.test("POST /login with correct password sets cookie and redirects", async () => {
  const req = new Request("http://localhost/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "password=demo",
  });
  const res = await app.request(req);
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "/dashboard");
  const setCookie = res.headers.get("set-cookie");
  assertStringIncludes(setCookie!, "session_id=demo-session");
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

Deno.test("Dashboard integration flow: Create student -> Link -> Sync progress", async () => {
  // 1. Create student
  const createStudentReq = new Request("http://localhost/dashboard/student", {
    method: "POST",
    headers: { 
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": "session_id=demo-session"
    },
    body: "name=IntegrationTestStudent",
  });
  const createRes = await app.request(createStudentReq);
  assertEquals(createRes.status, 302);
  assertEquals(createRes.headers.get("location"), "/dashboard");

  // 2. Fetch dashboard to find the link code (hacky but works for integration)
  const dashReq = new Request("http://localhost/dashboard", {
    headers: { "Cookie": "session_id=demo-session" }
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
      "X-Student-ID": studentId
    },
    body: JSON.stringify({ "test-game": { "test-item": { seen: 1, right: 1 } } }),
  });
  const progressRes = await app.request(progressReq);
  assertEquals(progressRes.status, 200);
  const progressData = await progressRes.json();
  assertEquals(progressData.success, true);
  
  // 5. Verify progress in dashboard
  const studentDashReq = new Request(`http://localhost/dashboard/student/${studentId}`, {
    headers: { "Cookie": "session_id=demo-session" }
  });
  const studentDashRes = await app.request(studentDashReq);
  const studentDashHtml = await studentDashRes.text();
  assertStringIncludes(studentDashHtml, "test-game");
});
