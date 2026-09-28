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
  var lastEmail = "";
  var lastCreds = null;

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

  function ensureLib() {
    if (window.supabase) return Promise.resolve();
    var local = (window.location.origin || "") + "/lib_supabase.js";
    var to = setTimeout(function () { fallback(); }, 15000);
    function fallback() {
      clearTimeout(to);
      return loadScript("https://unpkg.com/@supabase/supabase-js@2").catch(function () {
        throw new Error("تعذّر تحميل مكتبة السحابة. تحقق من الإنترنت.");
      });
    }
    return loadScript(local).then(clearTimeout.bind(null, to), fallback);
  }

  function client() { return sb; }

  function orgId() { return orgRow ? orgRow.id : null; }

  function isOnline() { return ONLINE && !!sb; }

  function init(cfg) {
    if (cfg) { CFG = cfg; window.MIZAN_CONFIG = cfg; }
    ONLINE = !!(CFG.url && CFG.anon);
    if (!ONLINE) return false;
    if (!window.supabase) return false;
    // persistSession:false = الجلسة تفضل في ذاكرة الصفحة فقط.
    // ده بيحل مشكلة معلّقة الدخول في المتصفح (قفل التخزين/الجلسة
    // كان بيعلّق لحين forever لما بيتحفظ في localStorage عبر مكتبة supabase-js).
    // الاستمرار بعد التحديث بيتعمل بتوكنات بنحفظها بنفسنا (autoLogin بالأسفل).
    sb = window.supabase.createClient(CFG.url, CFG.anon, {
      auth: { persistSession: false, autoRefreshToken: true }
    });
    return true;
  }

  // ---------- جلسة مستمرة عبر التحديث/إعادة الفتح (الموبايل) ----------
  // بنحفظ توكنات Supabase في localStorage بنفسنا (بعيدًا عن قفل المكتبة)،
  // وعند الفتح بنسترجع الجلسة بيهم — ولو انتهت صلاحية access بنجدده بـ refresh.
  var SES_KEY = "mizan_session_v1";
  function saveSessionTokens(session) {
    try {
      if (session && session.access_token && session.refresh_token) {
        localStorage.setItem(SES_KEY, JSON.stringify({
          a: session.access_token, r: session.refresh_token
        }));
      }
    } catch (e) { }
  }
  function clearSessionTokens() {
    try { localStorage.removeItem(SES_KEY); } catch (e) { }
  }
  function autoLogin() {
    var raw = null;
    try { raw = localStorage.getItem(SES_KEY); } catch (e) { }
    if (!raw) return Promise.resolve(false);
    var tok = null;
    try { tok = JSON.parse(raw); } catch (e) { }
    if (!tok || !tok.a || !tok.r) { clearSessionTokens(); return Promise.resolve(false); }
    return ensureLib().then(function () {
      if (!sb) init();
      if (!sb) return false;
      return sb.auth.setSession({ access_token: tok.a, refresh_token: tok.r }).then(function (r) {
        if (r.error || !r.data || !r.data.session) { clearSessionTokens(); return false; }
        saveSessionTokens(r.data.session); // التوكنات بتتجدد — نخزن أحدث نسخة
        lastCreds = null; // مش محتاجين باسورد مخزن في الذاكرة
        return loadProfile().then(function () { return true; })
          .catch(function () { clearSessionTokens(); return false; });
      }).catch(function () { clearSessionTokens(); return false; });
    });
  }

  // ---------- الدخول (باسم المستخدم، وSupabase بيشوف إيميل وهمي ورا الكواليس) ----------
  function toEmail(username) {
    return (username || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "") + "@mizan.app";
  }

  function login(username, pass) {
    return ensureLib().then(function () {
      if (!sb) init();
      if (!sb) throw new Error("لا يوجد إعداد اتصال");
      return sb.auth.signInWithPassword({ email: toEmail(username), password: pass }).then(function (r) {
        if (r.error) throw r.error;
        lastCreds = { username: username, pass: pass };
        saveSessionTokens(r.data.session); // للاسترجاع التلقائي بعد التحديث/إعادة الفتح
        return loadProfile().then(function () { return true; });
      });
    });
  }

  function signup(username, pass) {
    return ensureLib().then(function () {
      if (!sb) init();
      if (!sb) throw new Error("لا يوجد إعداد اتصال");
      return sb.auth.signUp({ email: toEmail(username), password: pass }).then(function (r) {
        if (r.error) throw r.error;
        lastCreds = { username: username, pass: pass };
        saveSessionTokens(r.data.session);
        return r.data;
      });
    });
  }

  // لو الدخول ناجح ومفيش ملف/شركة لسه → هيكمل إنشاء الشركة
  function loadProfile() {
    return sb.auth.getUser().then(function (gu) {
      if (gu.error || !gu.data.user) throw gu.error || new Error("لا يوجد مستخدم");
      lastEmail = gu.data.user.email || lastEmail;
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

  // فحص وجود جلسة حقيقية قبل أي RPC يكتب ملفات/شركات (يمنع خطأ NULL id)
  function requireSession() {
    // getUser() بيجيب الجلسة من ذاكرة العميل (شغال مع persistSession:false)
    return sb.auth.getUser().then(function (s) {
      if (s.error || !s.data || !s.data.user) {
        var e = new Error("لا توجد جلسة دخول. أعد تسجيل الدخول ثم أعد المحاولة.");
        e.noSession = true;
        throw e;
      }
      return s.data.user;
    });
  }

  // إعادة الدخول تلقائيًا لو الجلسة انقطعت بعد التسجيل (بيحل ضياع الجلسة)
  function reloginThen(fn) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var to = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error("تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى."));
      }, 20000);
      function finish(p) {
        if (done) return;
        done = true;
        clearTimeout(to);
        resolve(p);
      }
      function fail(e) {
        if (done) return;
        done = true;
        clearTimeout(to);
        reject(e);
      }
      requireSession().then(function () {
        finish(fn());
      }).catch(function (e) {
        if (!e.noSession || !lastCreds) { fail(e); return; }
        sb.auth.signInWithPassword({ email: toEmail(lastCreds.username), password: lastCreds.pass }).then(function (r) {
          if (r.error) { fail(r.error); return; }
          saveSessionTokens(r.data.session);
          finish(fn());
        }).catch(fail);
      });
    });
  }

  // إنشاء شركة جديدة أول مرة
  function createOrg(orgName, name) {
    return reloginThen(function () {
      return sb.rpc("create_org_and_profile", { p_org_name: orgName, p_name: name || "" }).then(function (r) {
        if (r.error) throw r.error;
        return loadProfile();
      });
    });
  }

  // الانضمام لشركة برمز دعوة
  function joinOrg(code, name) {
    return reloginThen(function () {
      return sb.rpc("join_org", { p_code: code, p_name: name || "" }).then(function (r) {
        if (r.error) throw r.error;
        return loadProfile();
      });
    });
  }

  function logout() {
    return (sb ? sb.auth.signOut() : Promise.resolve()).then(function () {
      // 🛡 تنظيف هوية الحساب بالكامل: ما يفضلش بقايا صلاحيات/باسورد
      // من حساب سابق تُستخدم لو دخل حساب تاني في نفس المتصفح
      profile = null; orgRow = null;
      access = null; lastCreds = null; lastEmail = "";
      clearSessionTokens(); // خروج = نهاية الجلسة المستمرة
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

  function loadEagerAll() {
    var tasks = EAGER.map(function (t) {
      return sb.from(t).select("*").order("created_at", { ascending: true }).then(function (res) {
        if (res.error) throw res.error;
        return [t, res.data || []];
      });
    });
    return Promise.all(tasks).then(function (pairs) {
      var out = {};
      pairs.forEach(function (p) { out[p[0]] = p[1]; });
      return out;
    });
  }

  // عدد السطور الفعلية في الجدول (من غير قراءتها) — للتحقق قبل رفع بيانات تجريبية
  function countRows(t) {
    return sb.from(t).select("*", { count: "exact", head: true }).then(function (r) {
      if (r.error) throw r.error;
      return r.count || 0;
    });
  }

  // ---------- الجداول الكبيرة (تحميل عند الطلب بالصفحات) ----------
  function loadLazy(table, opts) {
    opts = opts || {};
    var sel = opts.select || "*";
    // بعض الجداول ليس لها created_at ولا doc_date → جلب بلا ترتيب
    var noCreated = { customer_txs: 1 };
    var noDateCol = { sale_items: 1, purchase_items: 1, journal_lines: 1 };
    var order = opts.order || { col: (noCreated[table] ? "doc_date" : "created_at"), dir: "desc" };
    var skipOrder = noDateCol[table] ? 1 : 0;
    var pages = opts.maxPages || MAX_PAGES;
    var rows = [];
    var rangeStart = 0;

    function buildOnePage() {
      var b = sb.from(table).select(sel);
      if (opts.eq) { opts.eq.forEach(function (c) { b = b.eq(c[0], c[1]); }); }
      if (opts.filter) { b = b.or(opts.filter); }
      if (opts.from !== undefined) b = b.gte(order.col, opts.from);
      if (opts.to !== undefined) b = b.lte(order.col, opts.to);
      if (skipOrder) return b.range(rangeStart, rangeStart + PAGE_SIZE - 1).then(function (res) {
        if (res.error) throw res.error;
        var data = res.data || [];
        rows = rows.concat(data);
        return data.length === PAGE_SIZE;
      });
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
  function email() { return lastEmail; }
  function org() { return orgRow; }
  function getProfile() { return profile; }

  // ---- حالة الوصول (الوقت/القفل/المزايا) من القاعدة ----
  var access = null; // allowed, reason, role, org_id, org_name, plan_start, plan_end, locked, blocked, is_superadmin, features
  // requestAccess يُستدعى فورًا بعد الدخول قبل فتح الشاشات
  function requestAccess() {
    return sb.rpc("mizan_access").then(function (r) {
      if (r.error) throw r.error;
      // الدالة بترجع مصفوفة من صف واحد أحيانًا → نظيّرها لكائن
      var d = r.data;
      if (Array.isArray(d)) d = d[0] || null;
      access = d || null;
      if (access && access.org_id) {
        // نحدّث الشركة الحالية المعروضة في التطبيق
        orgRow = { id: access.org_id, name: access.org_name };
      }
      return access;
    });
  }
  function accessInfo() { return access; }
  // هل الميزة مفعلة للشركة الحالية؟
   function featureEnabled(key) {
      if (!access) return true;
      if (access.locked || access.reason !== "ok") return false;
      var f = access.features || {};
      return f[key] !== false;
   }

   // القيمة الخام للصلاحية: true / false / undefined (غير محدَّدة)
   // تُستخدم للصلاحيات التي يجب أن تكون «مفعّلة صريحًا» (opt-in).
   function featureFlag(key) {
      if (!access) return undefined;
      var f = access.features || {};
      return f[key];
   }

  // ---- دوال المالك (إدارة الشركات والوقت والأعضاء) ----
  function adminOrgs() {
    return sb.rpc("mizan_admin_orgs").then(function (r) {
      if (r.error) throw r.error;
      return r.data || [];
    });
  }
  function adminMembers(orgId) {
    return sb.rpc("mizan_admin_members", { p_org_id: orgId }).then(function (r) {
      if (r.error) throw r.error;
      return r.data || [];
    });
  }
  function adminSetOrg(orgId, planStart, planEnd, locked, features) {
    return sb.rpc("mizan_admin_set_org", {
      p_org_id: orgId,
      p_plan_start: planStart || null,
      p_plan_end: planEnd || null,
      p_locked: locked,
      p_features: features || null
    }).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }
  function adminSetUser(userId, blocked) {
    return sb.rpc("mizan_admin_set_user", { p_user_id: userId, p_blocked: blocked }).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }
  function adminCreateOrg(orgName, username, password, maxMembers) {
    return sb.rpc("mizan_admin_create_org", {
      p_org_name: orgName,
      p_admin_username: username,
      p_admin_password: password,
      p_max_members: maxMembers || 5
    }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data;
      return Array.isArray(d) ? d[0] : d;
    });
  }
  function adminCreateUser(orgId, username, password, fullName, role) {
    return sb.rpc("mizan_admin_create_user", {
      p_org_id: orgId,
      p_username: username,
      p_password: password,
      p_full_name: fullName || null,
      p_role: role || "member"
    }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data;
      return Array.isArray(d) ? d[0] : d;
    });
  }
  function adminResetPassword(userId, newPassword) {
    return sb.rpc("mizan_admin_reset_password", { p_user_id: userId, p_new_password: newPassword }).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }
  function adminDeleteOrg(orgId, mode) {
    return sb.rpc("mizan_admin_delete_org", { p_org_id: orgId, p_mode: mode }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data;
      return Array.isArray(d) ? (d[0] || null) : d;
    });
  }
  function adminDeleteMember(userId) {
    return sb.rpc("mizan_admin_delete_member", { p_user_id: userId }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data;
      return Array.isArray(d) ? (d[0] || null) : d;
    });
  }
  function adminEditOrg(orgId, orgName, maxMembers, phone) {
    return sb.rpc("mizan_admin_edit_org", {
      p_org_id: orgId,
      p_org_name: orgName || null,
      p_max_members: maxMembers || null,
      p_phone: phone || null
    }).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }
  function adminGetPassword(userId) {
    return sb.rpc("mizan_admin_get_password", { p_user_id: userId }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data;
      return Array.isArray(d) ? (d[0] || null) : d;
    });
  }
  function adminSetUsername(userId, username) {
    return sb.rpc("mizan_admin_set_username", { p_user_id: userId, p_username: username }).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }

  // ---- دوال شركة العميل: إدارة الحسابات الفرعية (الموظفين) ----
  // معلومات شاشة «حسابات شركتي»: الاسم + الحد الأقصى + العدد الحالي + هل أنا المدير
  function orgInfo() {
    return sb.rpc("mizan_org_info").then(function (r) {
      if (r.error) throw r.error;
      var d = r.data;
      return Array.isArray(d) ? (d[0] || null) : (d || null);
    });
  }
  // قائمة الحسابات التابعة لشركتي (مدير الشركة أو السوبر أدمن)
  function orgMembers(orgId) {
    return sb.rpc("mizan_org_members", { p_org_id: orgId }).then(function (r) {
      if (r.error) throw r.error;
      return r.data || [];
    });
  }
  // تسجيل بيانات حساب الموظف المُنشأ حتى تصل للمالك (سوبر أدمن)
  function logCreatedAccount(orgId, username, password, fullName, features) {
    return sb.rpc("mizan_log_created_account", {
      p_org_id: orgId,
      p_username: username,
      p_password: password,
      p_full_name: fullName || null,
      p_features: features || null
    }).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  }
  // المالك: كل السجل / سجل شركة واحدة
  function adminCreatedAccounts(orgId) {
    return sb.rpc("mizan_admin_created_accounts", { p_org_id: orgId || null }).then(function (r) {
      if (r.error) throw r.error;
      return r.data || [];
    });
  }
  function adminDeleteCreatedAccount(id) {
    return sb.rpc("mizan_admin_delete_created_account", { p_id: id }).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }
  // إضافة حساب فرعي (يوزرنيم + باسورد + اسم + دور + صلاحيات jsonb)
  function orgAddMember(username, password, fullName, role, features) {
    return sb.rpc("mizan_org_add_member", {
      p_username: username,
      p_password: password,
      p_full_name: fullName || null,
      p_role: role || "member",
      p_features: features || null
    }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data;
      return Array.isArray(d) ? d[0] : d;
    });
  }
  // تعديل صلاحيات حساب فرعي
  function orgSetFeatures(userId, features) {
    return sb.rpc("mizan_org_set_features", { p_user_id: userId, p_features: features }).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }
  // حذف حساب فرعي (يُعاد استخدام اسم المستخدم بعده)
  function orgDeleteMember(userId) {
    return sb.rpc("mizan_org_delete_member", { p_user_id: userId }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data;
      return Array.isArray(d) ? (d[0] || null) : (d || null);
    });
  }

  function passwordLog() {
    return sb.rpc("mizan_admin_password_log").then(function (r) {
      if (r.error) throw r.error;
      return r.data || [];
    });
  }
  // نسخة احتياطية شاملة للمالك: كل جداول كل الشركات في كائن واحد
  function adminExportAll() {
    return sb.rpc("mizan_admin_export_all").then(function (r) {
      if (r.error) throw r.error;
      return r.data || null;
    });
  }
  // نسخة احتياطية لشركة واحدة فقط (يختارها المالك)
  function adminExportOne(orgId) {
    return sb.rpc("mizan_admin_export_one", { p_org_id: orgId }).then(function (r) {
      if (r.error) throw r.error;
      return r.data || null;
    });
  }
  // استعادة نسخة احتياطية في شركة محددة (المالك فقط، بدون باسورد)
  function adminRestoreOne(orgId, payload) {
    return sb.rpc("mizan_admin_restore_one", { p_org_id: orgId, p_payload: payload }).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }
  // استعادة النسخة الشاملة (كل العملاء) — المالك فقط، بدون باسورد
  function adminRestoreAll(payload) {
    return sb.rpc("mizan_admin_restore_all", { p_payload: payload }).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }
  // العميل يغيّر كلمة مروره (يعرف القديم) — يُسجّل التنبيه للمالك تلقائيًا
function changeMyPassword(oldPass, newPass) {
   return sb.rpc("mizan_change_my_password", { p_old_password: oldPass || null, p_new_password: newPass }).then(function (r) {
   if (r.error) throw r.error;
   return true;
   });
   }
   // كلمة المرور الحالية اختيارية: يمرّر null فيتخطّى التحقق.
   // كلمة المرور الجديدة تُحفظ في mizan_pw_store ليقرأها المالك العام.
   // صاحب الشركة يغيّر كلمة مرور حساب من حسابات شركته فقط
   function orgResetMemberPassword(userId, newPass) {
   return sb.rpc("mizan_org_reset_member_password", { p_user_id: userId, p_new_password: newPass }).then(function (r) {
   if (r.error) throw r.error;
   return r.data || null;
   });
   }
   // قائمة كلمة المرور الحالية لكل الحسابات (للمالك العام فقط)
   function adminPwStore() {
   return sb.rpc("mizan_admin_pw_store").then(function (r) {
   if (r.error) throw r.error;
   return r.data || [];
   });
   }
  // نبضة حية: المستخدم "متصل الآن" (تستدعى كل 15 ثانية أثناء فتح التطبيق)
  function presenceHeartbeat() {
    return sb.rpc("mizan_presence_heartbeat").then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }
  // قائمة المتصلين حاليًا (للمالك فقط)
  function presenceOnline() {
    return sb.rpc("mizan_presence_online").then(function (r) {
      if (r.error) throw r.error;
      return r.data || [];
    });
  }

  // ---- تبويبات إعدادات الشركة (العميل: بيانات شركته فقط) ----
  // كل الدوال ترجع كائن الحمولة نفسه الذي تقبله دوال الحفظ (org + lists).
  function clientSett() {
    return sb.rpc("mizan_client_sett").then(function (r) {
      if (r.error) throw r.error;
      return r.data || null;
    });
  }
  function saveClientSett(payload) {
    return sb.rpc("mizan_client_sett_save", {
      p_org: payload.org || null,
      p_categories: payload.categories || null,
      p_units: payload.units || null,
      p_warehouses: payload.warehouses || null,
      p_owners: payload.owners || null,
      p_wallets: payload.wallets || null,
      p_banks: payload.banks || null
    }).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }
  // نسخة احتياطية للعميل: بيانات شركته فقط (كل الجداول)
  function clientExport() {
    return sb.rpc("mizan_client_export").then(function (r) {
      if (r.error) throw r.error;
      return r.data || null;
    });
  }
  // استعادة نسخة العميل: تطلب كلمة المرور الحالية أولًا (تحقق داخل القاعدة)
  function clientRestore(password, payload) {
    return sb.rpc("mizan_client_restore", { p_password: password, p_payload: payload }).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }
  // ---- المالك: تبويبات إعدادات أي شركة ----
  function adminSettLoad(orgId) {
    return sb.rpc("mizan_admin_sett_load", { p_org_id: orgId }).then(function (r) {
      if (r.error) throw r.error;
      return r.data || null;
    });
  }
  function adminSettSave(orgId, payload) {
    return sb.rpc("mizan_admin_sett_save", {
      p_org_id: orgId,
      p_org: payload.org || null,
      p_categories: payload.categories || null,
      p_units: payload.units || null,
      p_warehouses: payload.warehouses || null,
      p_owners: payload.owners || null,
      p_wallets: payload.wallets || null,
      p_banks: payload.banks || null
    }).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }

  window.DATA = {
    isOnline: isOnline,
    init: init,
    client: client,
    orgId: orgId,
    login: login,
    signup: signup,
    autoLogin: autoLogin,
    createOrg: createOrg,
    joinOrg: joinOrg,
    loadProfile: loadProfile,
    email: email,
    logout: logout,
    loadEager: loadEager,
    loadEagerAll: loadEagerAll,
    countRows: countRows,
    eagerCache: eagerCache,
    loadLazy: loadLazy,
    saveRow: saveRow,
    saveRows: saveRows,
    remove: remove,
    removeWhere: removeWhere,
    me: me,
    org: org,
    getProfile: getProfile,
    requestAccess: requestAccess,
    accessInfo: accessInfo,
      featureEnabled: featureEnabled,
      featureFlag: featureFlag,
    logCreatedAccount: logCreatedAccount,
    adminCreatedAccounts: adminCreatedAccounts,
    adminDeleteCreatedAccount: adminDeleteCreatedAccount,
    adminOrgs: adminOrgs,
    adminMembers: adminMembers,
    adminSetOrg: adminSetOrg,
    adminSetUser: adminSetUser,
    adminCreateOrg: adminCreateOrg,
    adminCreateUser: adminCreateUser,
    adminDeleteOrg: adminDeleteOrg,
    adminDeleteMember: adminDeleteMember,
    adminResetPassword: adminResetPassword,
    adminEditOrg: adminEditOrg,
    adminSetUsername: adminSetUsername,
    adminGetPassword: adminGetPassword,
    adminExportAll: adminExportAll,
    adminExportOne: adminExportOne,
    adminRestoreOne: adminRestoreOne,
    adminRestoreAll: adminRestoreAll,
    passwordLog: passwordLog,
      changeMyPassword: changeMyPassword,
      adminPwStore: adminPwStore,
      orgResetMemberPassword: orgResetMemberPassword,
    presenceHeartbeat: presenceHeartbeat,
    presenceOnline: presenceOnline,
    clientSett: clientSett,
    saveClientSett: saveClientSett,
    clientExport: clientExport,
    clientRestore: clientRestore,
    adminSettLoad: adminSettLoad,
    adminSettSave: adminSettSave,
    orgInfo: orgInfo,
    orgMembers: orgMembers,
    orgAddMember: orgAddMember,
    orgSetFeatures: orgSetFeatures,
    orgDeleteMember: orgDeleteMember,
    EAGER: EAGER
  };
})();