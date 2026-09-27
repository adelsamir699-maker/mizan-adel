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

const isLocalRequest = (req) => {
  const ip = req.socket.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip.endsWith("127.0.0.1");
};

let handler = (req, res) => {
  let rawPath = req.url.split("?")[0];
  let urlPath;
  try {
    urlPath = decodeURIComponent(rawPath);
  } catch (e) {
    urlPath = rawPath;
  }

  // API لحفظ واسترجاع البيانات على قرص D: مباشرة داخل مجلد db (محمي: للأجهزة المحلية فقط)
  if (urlPath === "/api/save" && req.method === "POST") {
    if (!isLocalRequest(req)) {
      res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "403 - الحفظ متاح محلياً فقط من نفس الجهاز" }));
      return;
    }
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        JSON.parse(body); // تحقق من صحة بنية الـ JSON
        const dbDir = path.join(__dirname, "db");
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
        const filePath = path.join(dbDir, "mizan_local_data.json");
        fs.writeFileSync(filePath, body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, path: filePath }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: "بنية البيانات غير صالحة: " + err.message }));
      }
    });
    return;
  }

  if (urlPath === "/api/load" && req.method === "GET") {
    if (!isLocalRequest(req)) {
      res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "403 - قراءة البيانات متاحة محلياً فقط من نفس الجهاز" }));
      return;
    }
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

  // حماية من ثغرة Path Traversal: منع الخروج خارج مجلد البرنامج
  const safePath = path.normalize(path.join(__dirname, urlPath));
  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 - وصول غير مصرح به خارج مجلد البرنامج");
    return;
  }

  const ext = path.extname(safePath);
  fs.readFile(safePath, (err, data) => {
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