const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/authResponse.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, { exports: exportsObject });
const { readAuthResponse } = exportsObject;

test("Vercel HTML errors are distinguished from invalid registration fields", async () => {
  await assert.rejects(readAuthResponse(new Response("<html>Function crashed</html>", { status: 500 }), false), /后端服务.*HTTP 500/);
  await assert.rejects(readAuthResponse(new Response("Not Found", { status: 404 }), false), /账号接口无法访问.*HTTP 404/);
  await assert.rejects(readAuthResponse(new Response(JSON.stringify({ detail: "private database credentials" }), { status: 503 }), false), (error) => {
    assert.match(error.message, /HTTP 503/);
    assert.ok(!error.message.includes("credentials"));
    return true;
  });
});

test("frontend HTML fallback cannot be accepted as a successful login", async () => {
  await assert.rejects(readAuthResponse(new Response("<html>Frontend</html>"), true), /异常响应/);
});

test("validation errors identify the username and valid sessions still work", async () => {
  const validation = new Response(JSON.stringify({ detail: [{ loc: ["body", "username"], type: "string_too_short" }] }), { status: 422 });
  await assert.rejects(readAuthResponse(validation, false), /用户名需要/);
  const session = { token: "test-token", user: { id: 1, email: "test@example.test" } };
  const result = await readAuthResponse(new Response(JSON.stringify(session), { status: 201 }), false);
  assert.equal(result.token, session.token);
  assert.equal(result.user.id, 1);
});
