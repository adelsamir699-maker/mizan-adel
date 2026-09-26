const http = require("http");
const fs = require("fs");
const path = require("path");

const ports = [3001, 3060];
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

let handler = (req, res) => {
  let urlPath = req.url.split("?")[0];
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