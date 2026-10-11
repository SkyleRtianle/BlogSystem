const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/photoUpload.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function loadUploader(fetch) {
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, fetch, FormData,
    require(name) {
      assert.equal(name, "@/lib/auth");
      return {
        authHeaders: (token) => ({ Authorization: `Bearer ${token}` }),
        ensureAuthorized(response) {
          if (response.status === 401) throw new Error("Login expired");
        },
      };
    },
  });
  return exports.uploadPhoto;
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

test("large photos go directly to R2 without sending the app token", async () => {
  const calls = [];
  const file = new File([new Uint8Array(5 * 1024 * 1024)], "large.png", { type: "image/png" });
  const upload = loadUploader(async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return json({ storage: "r2", filename: "1_key.png", content_type: "image/png", upload_url: "https://r2.example.test/signed-put" });
    return calls.length === 2 ? new Response(null, { status: 200 }) : json({ id: 10 }, 201);
  });
  assert.equal((await upload("/api", "app-token", file, "album", "description")).status, 201);
  assert.equal(calls[0].url, "/api/photos/upload-url");
  assert.equal(JSON.parse(calls[0].options.body).size, file.size);
  assert.equal(calls[1].url, "https://r2.example.test/signed-put");
  assert.equal(calls[1].options.body, file);
  assert.equal(calls[1].options.headers.Authorization, undefined);
  assert.equal(calls[1].options.headers["Content-Type"], "image/png");
  assert.equal(calls[2].url, "/api/photos/complete");
  assert.equal(calls[2].options.headers.Authorization, "Bearer app-token");
  assert.equal(JSON.parse(calls[2].options.body).filename, "1_key.png");
});

test("local development keeps multipart uploads", async () => {
  const calls = [];
  const file = new File(["image"], "local.png", { type: "image/png" });
  const upload = loadUploader(async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? json({ storage: "local" }) : json({ id: 1 }, 201);
  });
  await upload("/api", "token", file, "album", "description");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "/api/photos");
  assert.equal(calls[1].options.body.get("title"), "album");
  assert.equal(calls[1].options.body.get("file").name, "local.png");
});

test("failed R2 transfers never create a photo database record", async () => {
  const calls = [];
  const upload = loadUploader(async (url) => {
    calls.push(url);
    return calls.length === 1
      ? json({ storage: "r2", filename: "key.png", content_type: "image/png", upload_url: "https://r2.example.test/put" })
      : new Response(null, { status: 403 });
  });
  await assert.rejects(upload("/api", "token", new File(["image"], "a.png", { type: "image/png" }), "title", ""), /照片上传失败/);
  assert.equal(calls.length, 2);
  assert.ok(!calls.includes("/api/photos/complete"));
});

test("expired authentication prevents requesting storage uploads", async () => {
  let count = 0;
  const upload = loadUploader(async () => {
    count += 1;
    return new Response(null, { status: 401 });
  });
  await assert.rejects(upload("/api", "token", new File(["image"], "a.png", { type: "image/png" }), "title", ""), /Login expired/);
  assert.equal(count, 1);
});
