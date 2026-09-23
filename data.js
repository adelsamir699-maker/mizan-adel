// ============================================================
// ميزان - طبقة البيانات المركزية (Supabase)
// أسلوب موفّر للاستهلاك:
//  - تحميل انتقائي: جداول صغيرة فورًا، والكبيرة عند الطلب بالصفحات
//  - حفظ فردي: السطر المتغيّر بس، مش الجدول كله كل مرة
//  - أعمدة محددة للقوائم بدل جلب كل الحقول
//  - تقارير بفترة زمنية (افتراضية: آخر 30 يوم)
// ============================================================
(function () {
  "use strict";

  var CFG = window.MIZAN_CONFIG || { url: "", anon: "" };
  var ONLINE = !!(CFG.url && CFG.anon);
  var sb = null;
  var profile = null;
  var orgRow = null;

  // الجداول الصغيرة اللي تُحمَّل مرة واحدة عند الدخول
  var EAGER = ["customers", "suppliers", "products", "treasury", "accounts"];
  // الجداول الكبيرة: تُحمَّل عند الطلب فقط
  var LAZY = ["sales", "sale_items", "purchases", "purchase_items", "supplier_txs",
    "vouchers", "journal_entries", "journal_lines", "audit_logs"];
  var PAGE_SIZE = 500;
  var MAX_PAGES = 5; // حد أقصى 2500 سطر للجداول الكبيرة (مع البحث/الترقيم)

  function cacheKey(t) {
    var uid = (profile && profile.id) || "anon";
    var org = orgId() || "noorg";
    return "mizan_db_" + uid + "_" + org + "_" + t;
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function client() { return sb; }

  function orgId() { return orgRow ? orgRow.id : null; }

  function isOnline() { return ONLINE; }

  function init(cfg) {
    if (cfg) { CFG = cfg; window.MIZAN_CONFIG = cfg; }
    ONLINE = !!(CFG.url && CFG.anon);
    if (!ONLINE) return false;
    if (!window.supabase) return false;
    sb = window.supabase.createClient(CFG.url, CFG.anon);
    return true;
  }

  function ensureLib() {
    if (window.supabase) return Promise.resolve();
    return loadScript("https://unpkg.com/@supabase/supabase-js@2");
  }

  // ---------- الدخول ----------
  function login(email, pass) {
    return ensureLib().then(function () {
      if (!sb) init();
      if (!sb) throw new Error("لا يوجد إعداد اتصال");
      return sb.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
        if (r.error) throw r.error;
        return loadProfile().then(function () { return true; });
      });
    });
  }

  function signup(email, pass) {
    return ensureLib().then(function () {
      if (!sb) init();
      if (!sb) throw new Error("لا يوجد إعداد اتصال");
      return sb.auth.signUp({ email: email, password: pass }).then(function (r) {
        if (r.error) throw r.error;
        return r.data;
      });
    });
  }

  // لو الدخول ناجح ومفيش ملف/شركة لسه → هيكمل إنشاء الشركة
  function loadProfile() {
    return sb.auth.getUser().then(function (gu) {
      if (gu.error || !gu.data.user) throw gu.error || new Error("لا يوجد مستخدم");
      return sb.from("profiles").select("*").eq("id", gu.data.user.id).maybeSingle().then(function (p) {
        if (p.error) throw p.error;
        profile = p.data || null;
        if (profile) {
          return sb.from("organizations").select("*").eq("id", profile.org_id).maybeSingle().then(function (o) {
            if (o.error) throw o.error;
            orgRow = o.data || null;
            return orgRow;
          });
        }
        return null;
      });
    });
  }

  // إنشاء شركة جديدة أول مرة
  function createOrg(orgName, name) {
    return sb.rpc("create_org_and_profile", { p_org_name: orgName, p_name: name || "" }).then(function (r) {
      if (r.error) throw r.error;
      return loadProfile();
    });
  }

  // الانضمام لشركة برمز دعوة
  function joinOrg(code, name) {
    return sb.rpc("join_org", { p_code: code, p_name: name || "" }).then(function (r) {
      if (r.error) throw r.error;
      return loadProfile();
    });
  }

  function logout() {
    return (sb ? sb.auth.signOut() : Promise.resolve()).then(function () {
      profile = null; orgRow = null;
    });
  }

  // ---------- الجداول الصغيرة (تحميل فورًا + كاش) ----------
  function loadEager() {
    var tasks = EAGER.map(function (t) {
      return sb.from(t).select("*").order("created_at", { ascending: true }).then(function (res) {
        if (res.error) throw res.error;
        try { localStorage.setItem(cacheKey(t), JSON.stringify(res.data || [])); } catch (e) { }
        return res.data || [];
      });
    });
    return Promise.all(tasks).then(function (lists) {
      var out = {};
      EAGER.forEach(function (t, i) { out[t] = lists[i]; });
      return out;
    });
  }
  function eagerCache(t) {
    try { return JSON.parse(localStorage.getItem(cacheKey(t)) || "null"); } catch (e) { return null; }
  }

  // ---------- الجداول الكبيرة (تحميل عند الطلب بالصفحات) ----------
  function loadLazy(table, opts) {
    opts = opts || {};
    var sel = opts.select || "*";
    var order = opts.order || { col: "doc_date", dir: "desc" };
    var pages = opts.maxPages || MAX_PAGES;
    var rows = [];
    var rangeStart = 0;

    function buildOnePage() {
      var b = sb.from(table).select(sel);
      if (opts.eq) { opts.eq.forEach(function (c) { b = b.eq(c[0], c[1]); }); }
      if (opts.filter) { b = b.or(opts.filter); }
      if (opts.from !== undefined) b = b.gte(order.col, opts.from);
      if (opts.to !== undefined) b = b.lte(order.col, opts.to);
      return b.order(order.col, { ascending: order.dir === "asc" }).range(rangeStart, rangeStart + PAGE_SIZE - 1).then(function (res) {
        if (res.error) throw res.error;
        var data = res.data || [];
        rows = rows.concat(data);
        return data.length === PAGE_SIZE;
      });
    }

    var step = 0;
    function loop() {
      if (step >= pages) return rows;
      return buildOnePage().then(function (full) {
        step++;
        if (!full || step >= pages) return rows;
        rangeStart += PAGE_SIZE;
        return loop();
      });
    }
    return loop();
  }

  // ---------- الحفظ الموفر (السطر الفردي) ----------
  function saveRow(table, row) {
    if (!row.id) row.id = crypto.randomUUID();
    if (!row.org_id) row.org_id = orgId();
    return sb.from(table).upsert(row, { onConflict: "id" }).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  }
  function saveRows(table, rows) {
    if (!rows || !rows.length) return Promise.resolve([]);
    var o = orgId();
    rows.forEach(function (r) {
      if (!r.id || !r.id.length) r.id = (crypto.randomUUID && crypto.randomUUID());
      if (!r.org_id) r.org_id = o;
    });
    return sb.from(table).upsert(rows, { onConflict: "id" }).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  }
  function remove(table, id) {
    return sb.from(table).delete().eq("id", id).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }
  // حذف سطور كبيرة تابعة (مثل items) بالمعرّف الأب
  function removeWhere(table, col, val) {
    return sb.from(table).delete().eq(col, val).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }

  function me() { return profile; }
  function org() { return orgRow; }
  function getProfile() { return profile; }

  window.DATA = {
    isOnline: isOnline,
    init: init,
    client: client,
    orgId: orgId,
    login: login,
    signup: signup,
    createOrg: createOrg,
    joinOrg: joinOrg,
    loadProfile: loadProfile,
    logout: logout,
    loadEager: loadEager,
    eagerCache: eagerCache,
    loadLazy: loadLazy,
    saveRow: saveRow,
    saveRows: saveRows,
    remove: remove,
    removeWhere: removeWhere,
    me: me,
    org: org,
    getProfile: getProfile,
    EAGER: EAGER
  };
})();