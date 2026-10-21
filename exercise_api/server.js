const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const exercises = JSON.parse(
  fs.readFileSync(path.join(__dirname, "exercises.json"), "utf8"),
);
const port = Number(process.env.EXERCISE_API_PORT || 8001);

function handleRequest(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, service: "fitai-exercise-api" }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/exercises") {
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const category = (url.searchParams.get("category") || "all").trim().toLowerCase();
    const result = exercises.filter((exercise) => {
      const matchesCategory = category === "all" || exercise.category === category;
      const matchesSearch = !search ||
        exercise.name.toLowerCase().includes(search) ||
        exercise.muscle.toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    });
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ exercises: result, total: result.length }));
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: "Not found" }));
}

function createServer() {
  return http.createServer(handleRequest);
}

if (require.main === module) {
  createServer().listen(port, "0.0.0.0", () => {
    console.log(`FITAI Exercise API ready at http://0.0.0.0:${port}`);
  });
}

module.exports = { createServer, handleRequest };
