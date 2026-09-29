const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

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
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const isLocalRequest = (req) => {
  const ip = req.socket.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip.endsWith("127.0.0.1");
};

/* ================================================================
   مدير مستندات ميزان — مخزن مستندات العملاء والموردين
   القواعد (فكرة الفاست بكلس): كل جهاز بيحفظ المستندات بتاعته على
   قرصه المحلي (خارج C دائمًا) عن طريق سيرفره هو — الجذر الافتراضي
   D:\MizanDocuments، وإلا أول Partition متاح غير C (E/F...)، ولو
   مفيش غير C المستخدم هو اللي يحدد مكان مناسب. لقاعدة البيانات
   يروح المسار النسبي بس + اسم الجهاز عشان باقي الأجهزة تعرف النسخة فين.
   ================================================================ */
const os = require("os");
const { execFile } = require("child_process");
const DOC_CFG_FILE = path.join(__dirname, "db", "mizan_doc_root.json");
const DOC_BASE_NAME = "MizanDocuments";
const C_DRIVE = /^[cC]:/;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 80 * 1024 * 1024) { reject(new Error("الملف كبير جدًا")); req.destroy(); } });
    req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

function sendJson(res, code, obj, extraHeaders) {
  const h = Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, extraHeaders || {});
  res.writeHead(code, h);
  res.end(JSON.stringify(obj));
}

function driveExists(letter) {
  try { return fs.existsSync(letter + ":\\"); } catch (e) { return false; }
}

function docCfg() {
  try { return JSON.parse(fs.readFileSync(DOC_CFG_FILE, "utf-8")); } catch (e) { return {}; }
}

// الجذر: إعدادات الجهاز أولًا (لو سليمة)، وبعدها D، وبعدها أي Partition غير C
function resolveDocRoot(createIfMissing) {
  const cfg = docCfg();
  if (cfg.root && !C_DRIVE.test(cfg.root)) {
    try {
      if (fs.existsSync(cfg.root)) return { ok: true, root: cfg.root, source: "config" };
      if (createIfMissing) { fs.mkdirSync(cfg.root, { recursive: true }); return { ok: true, root: cfg.root, source: "config" }; }
    } catch (e) { /* نجرب الاكتشاف التلقائي */ }
  }
  const letters = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
  // 1) مجلد MizanDocuments موجود فعلًا على Partition ما (إعادة ربط تلقائي بعد فورمات C)
  for (const L of letters) {
    const p = L + ":\\" + DOC_BASE_NAME;
    if (driveExists(L) && fs.existsSync(p)) return { ok: true, root: p, source: "found" };
  }
  // 2) أول Partition غير C: ننشئ عليه المجلد
  if (createIfMissing) {
    for (const L of letters) {
      if (driveExists(L)) {
        const p = L + ":\\" + DOC_BASE_NAME;
        try {
          fs.mkdirSync(p, { recursive: true });
          const probe = path.join(p, ".write_test");
          fs.writeFileSync(probe, "1"); fs.unlinkSync(probe);
          const conf = { root: p };
          try { fs.mkdirSync(path.dirname(DOC_CFG_FILE), { recursive: true }); fs.writeFileSync(DOC_CFG_FILE, JSON.stringify(conf)); } catch (e) {}
          return { ok: true, root: p, source: "created" };
        } catch (e) { /* جرّب الحرف التالي */ }
      }
    }
  } else {
    for (const L of letters) { if (driveExists(L)) return { ok: false, needPick: true, firstAlt: L }; }
  }
  return { ok: false, needPick: true, onlyC: true };
}

// أمان: مسار نسبي نظيف داخل الجذر فقط (بلا .. وبلا حرف قرص)
function safeJoin(root, rel) {
  if (!rel || typeof rel !== "string") return null;
  const clean = rel.replace(/\//g, "\\").replace(/^[\\]+/, "");
  if (/\.\./.test(clean) || /^[a-zA-Z]:/.test(clean)) return null;
  const full = path.normalize(path.join(root, clean));
  if (!full.startsWith(path.normalize(root))) return null;
  return full;
}

function docRoutes(req, res, urlPath) {
  if (!urlPath.startsWith("/api/doc/")) return false;
  // CORS: يخلي الصفحة المفتوحة من رابط الويب تقدر تخاطب سيرفر الجهاز *نفسه*
  // (الطلبات دي بتيجي من 127.0.0.1 بتاع نفس الجهاز — السيرفرات تفضل مقفولة في وش الشبكات)
  const DOC_CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "600",
  };
  if (req.method === "OPTIONS") { res.writeHead(204, DOC_CORS); res.end(); return true; }
  if (!isLocalRequest(req)) { sendJson(res, 403, { ok: false, error: "403 — أذرع المستندات تستقبل أوامر من جهازها هي فقط" }); return true; }

  const done = (code, obj) => sendJson(res, code, obj, DOC_CORS);

  if (urlPath === "/api/doc/status" && req.method === "GET") {
    // كل جهاز بيجهّز مكانه الخاص (خارج C دائمًا) — الجهاز جهازُ نفسه في المستندات
    const r = resolveDocRoot(true);
    done(200, Object.assign({ ok: r.ok, device: os.hostname(), isDocManager: true }, r));
    return true;
  }

  if (urlPath === "/api/doc/root" && req.method === "POST") {
    readJsonBody(req).then((b) => {
      let root = String(b.root || "").trim();
      if (!root) { const r = resolveDocRoot(true); return done(200, r.ok ? { ok: true, root: r.root } : { ok: false, needPick: true }); }
      if (!/^[a-zA-Z]:[\\/]/.test(root)) return done(200, { ok: false, error: "لازم يكون مسارًا مطلقًا مثل D:\\MizanDocuments" });
      if (C_DRIVE.test(root)) return done(200, { ok: false, error: "ممنوع التخزين على القرص C — اختار Partition تاني (D أو E أو F)" });
      if (!/MizanDocuments$/i.test(root.replace(/[\\]+$/, ""))) root = path.join(root, DOC_BASE_NAME);
      try {
        fs.mkdirSync(root, { recursive: true });
        const probe = path.join(root, ".write_test");
        fs.writeFileSync(probe, "1"); fs.unlinkSync(probe);
        fs.writeFileSync(DOC_CFG_FILE, JSON.stringify({ root }));
        done(200, { ok: true, root });
      } catch (e) { done(200, { ok: false, error: "تعذّر إنشاء المجلد أو الكتابة عليه: " + e.message }); }
    }).catch((e) => done(400, { ok: false, error: e.message }));
    return true;
  }

  if (urlPath === "/api/doc/save" && req.method === "POST") {
    readJsonBody(req).then((b) => {
      const r = resolveDocRoot(true);
      if (!r.ok) return done(200, { ok: false, error: "لا يوجد Partition متاح غير C للتخزين — حدّد مسارًا من الإعدادات", needPick: true });
      const partyType = b.partyType === "supplier" ? "supplier" : "customer";
      const folderName = partyType === "supplier" ? "Suppliers" : "Clients";
      // رقم الجهة من الكود (CUST-1258 أو SUPP-007 أو 1258) — أرقام فقط
      const num = String(b.partyCode || "").replace(/^[A-Za-z]+-/, "").replace(/[^0-9]/g, "") || String(b.partyCode || "0").replace(/[^A-Za-z0-9_-]/g, "");
      const dir = path.join(r.root, folderName, num);
      try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { return done(200, { ok: false, error: "تعذّر إنشاء مجلد الجهة: " + e.message }); }
      // تسلسل تلقائي: 001, 002, ...
      let seq = 1;
      try {
        const names = fs.readdirSync(dir);
        names.forEach((n) => { const m = /^(\d+)\./.exec(n); if (m) seq = Math.max(seq, +m[1] + 1); });
      } catch (e) {}
      const ext = String(b.fileExt || (b.fileName || "").split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
      const name = String(seq).padStart(3, "0") + "." + ext;
      let buf;
      try { buf = Buffer.from(String(b.base64 || ""), "base64"); if (!buf.length) throw new Error("الملف فارغ"); } catch (e) { return done(200, { ok: false, error: "تعذّر قراءة الملف: " + e.message }); }
      const full = path.join(dir, name);
      try { fs.writeFileSync(full, buf); } catch (e) { return done(200, { ok: false, error: "فشل حفظ الملف على القرص: " + e.message }); }
      const rel = folderName + "\\" + num + "\\" + name;
      done(200, { ok: true, rel, name, originalName: b.fileName || name, size: buf.length, root: r.root });
    }).catch((e) => done(400, { ok: false, error: e.message }));
    return true;
  }

  if ((urlPath === "/api/doc/open" || urlPath === "/api/doc/exists" || urlPath === "/api/doc/delete") && req.method === "POST") {
    readJsonBody(req).then((b) => {
      const r = resolveDocRoot(false);
      if (!r.ok) return done(200, { ok: false, error: "مسار المستندات غير مُهيّأ على هذا الجهاز" });
      const full = safeJoin(r.root, b.rel);
      if (!full) return done(200, { ok: false, error: "مسار غير صالح" });
      if (!fs.existsSync(full)) return done(200, { ok: false, missing: true, error: "ملف المستند غير موجود على هذا الجهاز" });
      if (urlPath === "/api/doc/exists") return done(200, { ok: true, exists: true });
      if (urlPath === "/api/doc/delete") {
        try { fs.unlinkSync(full); done(200, { ok: true }); } catch (e) { done(200, { ok: false, error: "تعذّر حذف الملف: " + e.message }); }
        return true;
      }
      // open: برنامج الجهاز الافتراضي (detached حتى ميوقفش السيرفر)
      execFile("cmd", ["/c", "start", "", full], { detached: true, windowsHide: true, cwd: path.dirname(full) }, (err) => {
        if (err) return done(200, { ok: false, error: "تعذّر فتح الملف: " + err.message });
        done(200, { ok: true });
      });
    }).catch((e) => done(400, { ok: false, error: e.message }));
    return true;
  }

  if (urlPath === "/api/doc/scan" && req.method === "POST") {
    // يفتح تطبيق Windows Scan الرسمي + مجلد Scans جاهز لاستقبال الممسوح
    const r0 = resolveDocRoot(true);
    if (r0.ok) { try { fs.mkdirSync(path.join(r0.root, "Scans"), { recursive: true }); } catch (e) {} }
    execFile("cmd", ["/c", "start", "windowsscan:"], { detached: true, windowsHide: true }, (err) => {
      if (err) return sendJson(res, 200, { ok: false, error: "تطبيق المسح الضوئي مش متاح على الجهاز — استخدم «حفظ مستند من الجهاز» بعد المسح من برنامج الماسح" }, DOC_CORS);
      sendJson(res, 200, { ok: true, scansDir: r0.ok ? path.join(r0.root, "Scans") : null }, DOC_CORS);
    });
    return true;
  }

  if (urlPath === "/api/doc/scans" && req.method === "GET") {
    // قائمة الملفات الحديثة في مجلد المسح (Windows Scan يحفظ فيها)
    const r = resolveDocRoot(false);
    if (!r.ok) return done(200, { ok: false, error: "مسار المستندات غير مُهيّأ" });
    const dir = path.join(r.root, "Scans");
    try {
      if (!fs.existsSync(dir)) return done(200, { ok: true, files: [] });
      const files = fs.readdirSync(dir).map((n) => {
        try { const st = fs.statSync(path.join(dir, n)); return { name: n, size: st.size, mtime: st.mtimeMs }; } catch (e) { return null; }
      }).filter(Boolean).sort((a, b) => b.mtime - a.mtime).slice(0, 20);
      done(200, { ok: true, files });
    } catch (e) { done(200, { ok: false, error: e.message }); }
    return true;
  }

  if (urlPath === "/api/doc/scans_import" && req.method === "POST") {
    // نقل ملف ممسوح حديثًا من Scans إلى مجلد الجهة (نفس مسار save لكن المصدر قرص محلي)
    readJsonBody(req).then((b) => {
      const r = resolveDocRoot(true);
      if (!r.ok) return done(200, { ok: false, error: "مسار المستندات غير مُهيّأ" });
      const srcFull = safeJoin(r.root, "Scans\\" + String(b.name || "").replace(/[\\/:*?"<>|]/g, ""));
      if (!srcFull || !fs.existsSync(srcFull)) return done(200, { ok: false, error: "الملف الممسوح غير موجود في مجلد المسح" });
      const buf = fs.readFileSync(srcFull);
      const ext = (path.extname(srcFull) || ".bin").slice(1).toLowerCase();
      done(200, { ok: true, base64: buf.toString("base64"), size: buf.length, ext, originalName: b.name });
    }).catch((e) => done(400, { ok: false, error: e.message }));
    return true;
  }

  sendJson(res, 404, { ok: false, error: "404 — مسار مستندات غير معروف" }, DOC_CORS);
  return true;
}

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

  // Mizan Document Manager — كل مسارات /api/doc/* (محلي فقط)
  if (docRoutes(req, res, urlPath)) return;

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