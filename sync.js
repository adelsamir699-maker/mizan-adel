// ============================================================
// ميزان - Offline-First (المرحلة ١): كشف الاتصال + طابور outbox
// ------------------------------------------------------------
// الهدف: لما الاتصال ينقطع أثناء جلسة دخول، التعديلات تتطاب في طابور
// محلي (IndexedDB مع بديل localStorage) وتترفع تلقائيًا بأمان لما
// الاتصال يرجع. إعادة الدفع تستخدم نفس آلية syncOne الموجودة
// (detUuid + upsert onConflict) فالـ idempotency محفوظ.
//
// ملاحظة تصميمية: syncOne في cloud.js بيبتلع أخطاء الاستعلام
// (if res.error return) فبيرجع resolved حتى مع فشل الشبكة. عشان كده
// الاعتماد هنا على navigator.onLine لتحديد "أوفلاين" مش على catch فقط.
// ============================================================
(function () {
  "use strict";

  var DB_NAME = "mizan_sync";
  var DB_VERSION = 2;
  var STORE = "outbox";
  var CACHE = "cache";
  var LS_KEY = "mizan_outbox_v1";
  var CACHE_LS_KEY = "mizan_cache_v1";

  var idb = null;
  var useIDB = false;
  var pending = {};          // table -> count (مرآة في الذاكرة)
  var loaded = false;
  var flushing = false;

  var statusCbs = [];
  var onlineCbs = [];
  var offlineCbs = [];

  // ---------- التخزين ----------
  function lsRead() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function lsWrite(map) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(map || {})); } catch (e) { }
  }

  function openIDB() {
    return new Promise(function (resolve) {
      try {
        if (!window.indexedDB) { resolve(false); return; }
        var req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function () {
          try {
            var db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
              db.createObjectStore(STORE, { keyPath: "table" });
            }
            if (!db.objectStoreNames.contains(CACHE)) {
              db.createObjectStore(CACHE, { keyPath: "key" });
            }
          } catch (e) { }
        };
        req.onsuccess = function () { idb = req.result; resolve(true); };
        req.onerror = function () { resolve(false); };
        req.onblocked = function () { resolve(false); };
      } catch (e) { resolve(false); }
    });
  }

  function idbGetAll() {
    return new Promise(function (resolve) {
      if (!useIDB || !idb) { resolve(null); return; }
      try {
        var tx = idb.transaction(STORE, "readonly");
        var st = tx.objectStore(STORE);
        var req = st.getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }

  // كتابة على الطبقتين (ذاكرة + localStorage + IndexedDB)
  function persist() {
    lsWrite(pending);
    if (useIDB && idb) {
      try {
        var tx = idb.transaction(STORE, "readwrite");
        var st = tx.objectStore(STORE);
        st.clear();
        Object.keys(pending).forEach(function (t) {
          st.put({ table: t, count: Number(pending[t] || 1), queuedAt: Date.now() });
        });
      } catch (e) { }
    }
  }

  function load() {
    return openIDB().then(function (ok) {
      useIDB = ok;
      return idbGetAll();
    }).then(function (rows) {
      if (rows && rows.length) {
        pending = {};
        rows.forEach(function (r) {
          if (r && r.table) pending[r.table] = Number(r.count || 1);
        });
      } else {
        pending = lsRead();
      }
      loaded = true;
      emitStatus();
    }).catch(function () {
      pending = lsRead();
      loaded = true;
      emitStatus();
    });
  }

  // ---------- الكاش (لقطة بيانات للقراءة أوفلاين بعد إعادة الفتح) ----------
  function cacheSet(key, obj) {
    if (!useIDB || !idb) {
      try {
        var map = JSON.parse(localStorage.getItem(CACHE_LS_KEY) || "{}") || {};
        map[key] = { value: obj, at: Date.now() };
        localStorage.setItem(CACHE_LS_KEY, JSON.stringify(map));
      } catch (e) { }
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      try {
        var tx = idb.transaction(CACHE, "readwrite");
        tx.objectStore(CACHE).put({ key: key, value: obj, at: Date.now() });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
        tx.onabort = function () { resolve(); };
      } catch (e) { resolve(); }
    });
  }
  function cacheGet(key) {
    if (!useIDB || !idb) {
      try {
        var map = JSON.parse(localStorage.getItem(CACHE_LS_KEY) || "{}") || {};
        return Promise.resolve(map[key] ? map[key].value : null);
      } catch (e) { return Promise.resolve(null); }
    }
    return new Promise(function (resolve) {
      try {
        var tx = idb.transaction(CACHE, "readonly");
        var req = tx.objectStore(CACHE).get(key);
        req.onsuccess = function () { resolve(req.result ? req.result.value : null); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }
  function cacheDel(key) {
    if (!useIDB || !idb) {
      try {
        var map = JSON.parse(localStorage.getItem(CACHE_LS_KEY) || "{}") || {};
        delete map[key];
        localStorage.setItem(CACHE_LS_KEY, JSON.stringify(map));
      } catch (e) { }
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      try {
        var tx = idb.transaction(CACHE, "readwrite");
        tx.objectStore(CACHE).delete(key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      } catch (e) { resolve(); }
    });
  }

  // ---------- الحالة ----------
  function isOnline() {
    return (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean")
      ? navigator.onLine : true;
  }
  function totalCount() {
    var n = 0;
    Object.keys(pending).forEach(function (t) { n += Number(pending[t] || 0); });
    return n;
  }
  function renderBadge(s) {
    var el = document.getElementById("syncPending");
    if (!el) return;
    if (!s.online) {
      el.textContent = "🔴 أوفلاين" + (s.pending ? " · " + s.pending + " معلّق" : "");
      el.hidden = false;
    } else if (s.pending) {
      el.textContent = "🟠 " + s.pending + " معلّق";
      el.hidden = false;
    } else {
      el.textContent = "";
      el.hidden = true;
    }
  }
  function emitStatus() {
    var s = { online: isOnline(), pending: totalCount(), tables: Object.keys(pending) };
    renderBadge(s);
    statusCbs.forEach(function (cb) { try { cb(s); } catch (e) { } });
  }

  // ---------- الطابور ----------
  function enqueue(table) {
    if (!table) return;
    pending[table] = Number(pending[table] || 0) + 1;
    persist();
    emitStatus();
  }
  // نجاح دفع جدول → نشيله من الطابور
  function resolve(table) {
    if (!table || !(table in pending)) return;
    delete pending[table];
    persist();
    emitStatus();
  }
  function count() { return totalCount(); }
  function tables() { return Object.keys(pending); }
  function clear() { pending = {}; persist(); emitStatus(); }

  // إعادة الدفع: handler(table) لازم يرجع Promise.
  // عند النجاح نشيل الجدول، وعند الفشل يفضل متطاب ونكمل الباقي.
  function flush(handler) {
    if (typeof handler !== "function") return Promise.resolve();
    if (flushing) return Promise.resolve();
    flushing = true;
    var list = Object.keys(pending);
    var i = 0;
    function step() {
      if (i >= list.length) { flushing = false; return Promise.resolve(); }
      var t = list[i++];
      return Promise.resolve().then(function () {
        return handler(t);
      }).then(function () {
        if (t in pending) { delete pending[t]; persist(); emitStatus(); }
        return step();
      }).catch(function () {
        // فشل → يفضل متطاب، ونكمّل باقي الجداول
        return step();
      });
    }
    return step();
  }

  // ---------- الأحداث ----------
  function onStatus(cb) { if (typeof cb === "function") statusCbs.push(cb); }
  function setOnline(cb) { if (typeof cb === "function") onlineCbs.push(cb); }
  function setOffline(cb) { if (typeof cb === "function") offlineCbs.push(cb); }

  function wireEvents() {
    window.addEventListener("online", function () {
      emitStatus();
      onlineCbs.forEach(function (cb) { try { cb(); } catch (e) { } });
    });
    window.addEventListener("offline", function () {
      emitStatus();
      offlineCbs.forEach(function (cb) { try { cb(); } catch (e) { } });
    });
  }

  function init() {
    wireEvents();
    return load();
  }

  window.Sync = {
    init: init,
    enqueue: enqueue,
    resolve: resolve,
    flush: flush,
    count: count,
    tables: tables,
    clear: clear,
    isOnline: isOnline,
    isLoaded: function () { return loaded; },
    usingIndexedDB: function () { return useIDB; },
    onStatus: onStatus,
    setOnline: setOnline,
    setOffline: setOffline,
    cacheSet: cacheSet,
    cacheGet: cacheGet,
    cacheDel: cacheDel
  };

  // رسم أولي للشارة بمجرد جهوزية الـ DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { emitStatus(); });
  } else {
    emitStatus();
  }
})();
