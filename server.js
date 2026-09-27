const http = require("http");
const fs = require("fs");
const path = require("path");

const ports = [3001, 3060];
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

let handler = (req, res) => {
  let urlPath = req.url.split("?")[0];

  // API لحفظ واسترجاع البيانات على قرص D: مباشرة داخل مجلد db
  if (urlPath === "/api/save" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const dbDir = path.join(__dirname, "db");
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
        const filePath = path.join(dbDir, "mizan_local_data.json");
        fs.writeFileSync(filePath, body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, path: filePath }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (urlPath === "/api/load" && req.method === "GET") {
    const filePath = path.join(__dirname, "db", "mizan_local_data.json");
    if (fs.existsSync(filePath)) {
      fs.readFile(filePath, "utf-8", (err, data) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: err.message }));
          return;
        }
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        });
        res.end(data);
      });
    } else {
      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "No local data saved yet" }));
    }
    return;
  }

  if (["/", "/go", "/app", "/open"].indexOf(urlPath) >= 0) urlPath = "/index.html";
  const filePath = path.join(__dirname, urlPath);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 - غير موجود");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[ext] || "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    });
    res.end(data);
  });
};

ports.forEach((p) => {
  http.createServer(handler).listen(p, "0.0.0.0", () => {
    console.log(`Server running on network at http://0.0.0.0:${p}/`);
  });
});