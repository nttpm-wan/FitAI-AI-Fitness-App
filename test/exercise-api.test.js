const assert = require("node:assert/strict");
const { test } = require("node:test");
const { handleRequest } = require("../exercise_api/server");

function request(path, method = "GET") {
  const result = { status: 0, headers: {}, body: "" };
  const response = {
    setHeader(name, value) { result.headers[name.toLowerCase()] = value; },
    writeHead(status, headers = {}) {
      result.status = status;
      for (const [name, value] of Object.entries(headers)) result.headers[name.toLowerCase()] = value;
    },
    end(body = "") { result.body = body; },
  };

  handleRequest({ method, url: path, headers: { host: "localhost" } }, response);
  return { ...result, json: result.body ? JSON.parse(result.body) : null };
}

test("health endpoint reports the service", () => {
  const response = request("/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.json, { ok: true, service: "fitai-exercise-api" });
});

test("exercise endpoint returns the catalog and filters by category and search", () => {
  const all = request("/exercises");
  assert.equal(all.status, 200);
  assert.equal(all.json.total, 12);
  assert.equal(all.json.exercises[0].name, "Squat");

  const filtered = request("/exercises?category=chest&search=push-up");
  assert.equal(filtered.json.total, 1);
  assert.equal(filtered.json.exercises[0].name, "Push-up");
});

test("unknown routes return a JSON 404", () => {
  const response = request("/missing");
  assert.equal(response.status, 404);
  assert.deepEqual(response.json, { error: "Not found" });
});
