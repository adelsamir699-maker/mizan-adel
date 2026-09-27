// ============================================================
// ميزان - طبقة المزامنة مع قاعدة البيانات المركزية
// تحوّل بيانات البرنامج (الموجودة في الذاكرة) إلى/من جداول Supabase
// بمعرّفات ثابتة (deterministic) حتى لا تتكاثر السجلات
// ============================================================
(function () {
  "use strict";

  function hexHash(s) {
    var x = 2166136261;
    for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
    return x >>> 0;
  }
  function detUuid(table, localId) {
    var org = (DATA && DATA.orgId && DATA.orgId()) || "n";
    var a = (hexHash(org) >>> 0).toString(16).padStart(8, "0");
    var b = (hexHash(org + ":" + table) >>> 0).toString(16).padStart(8, "0");
    var c = (hexHash(org + ":" + table + ":" + localId) >>> 0).toString(16).padStart(8, "0");
    var tail = Number(localId).toString(16).padStart(12, "0").slice(-12);
    return a.slice(0, 8) + "-" + b.slice(0, 4) + "-4" + b.slice(4, 7) + "-" + c.slice(0, 4) + "-" + tail;
  }

  // خريطة تحويل (محلي → سماوي / سماوي → محلي)
  var META = {
    customers: {
      local: function () { return W.customers; },
      toCloud: function (r) {
        return { id: detUuid("customers", r.id), org_id: DATA.orgId(), local_id: r.id,
          code: r.code, name_ar: r.nameAr, name_en: r.nameEn || "", phone: r.phone || "",
          address: r.address || "", opening_balance: r.openingBalance || 0,
          credit_limit: r.creditLimit || 0, is_active: r.isActive !== false, deleted: false };
      },
      fromCloud: function (r) {
        return { id: r.local_id, code: r.code, nameAr: r.name_ar, nameEn: r.name_en || "",
          phone: r.phone || "", secondaryPhone: "", walletPhone: "", address: r.address || "",
          notes: "", openingBalance: Number(r.opening_balance || 0),
          currentBalance: Number(r.opening_balance || 0), creditLimit: Number(r.credit_limit || 0),
          isActive: r.is_active !== false, protected: false };
      }
    },
    suppliers: {
      local: function () { return W.suppliers; },
      toCloud: function (r) {
        return { id: detUuid("suppliers", r.id), org_id: DATA.orgId(), local_id: r.id,
          code: r.code, name_ar: r.nameAr, phone: r.phone || "", address: r.address || "",
          opening_balance: r.openingBalance || 0, current_balance: r.currentBalance || 0,
          is_active: r.isActive !== false, deleted: false };
      },
      fromCloud: function (r) {
        return { id: r.local_id, code: r.code, nameAr: r.name_ar, phone: r.phone || "",
          walletPhone: "", address: r.address || "", notes: "", openingBalance: Number(r.opening_balance || 0),
          currentBalance: Number(r.current_balance || 0),
          isActive: r.is_active !== false, protected: false };
      }
    },
    products: {
      local: function () { return W.products; },
      toCloud: function (r) {
        return { id: detUuid("products", r.id), org_id: DATA.orgId(), local_id: r.id,
          code: r.code, barcode: r.barcode || "", name_ar: r.nameAr, name_en: r.nameEn || "",
          category: r.category || "عام", purchase_price: r.purchasePrice || 0,
          sale_price: r.salePrice || 0, stock_qty: r.qty || 0, min_stock: r.reorder || 0,
          stock: r.stock || {}, is_active: r.isActive !== false };
      },
      fromCloud: function (r) {
        var stock = r.stock; // jsonb -> object {warehouse: qty}
        if (!stock || typeof stock !== "object" || Array.isArray(stock)) {
          // لنسخ الإصدارات القديمة بدون توزيع: رصيد المبلغ كله في المستودع الافتراضي
          stock = {};
          if (Number(r.stock_qty || 0) > 0) stock["المخزن الرئيسي"] = Number(r.stock_qty || 0);
        }
        return { id: r.local_id, code: r.code, barcode: r.barcode || "", nameAr: r.name_ar,
          nameEn: r.name_en || "", category: r.category || "عام", unit: "",
          defaultWarehouse: "المخزن الرئيسي", purchasePrice: Number(r.purchase_price || 0),
          weightedAvgCost: Number(r.purchase_price || 0), salePrice: Number(r.sale_price || 0),
          discountPercent: 0, discountStart: "", discountEnd: "",
          stock: stock, qty: Number(r.stock_qty || 0), reorder: Number(r.min_stock || 0),
          isActive: r.is_active !== false };
      }
    },
    treasury: {
      local: function () { return W.treasury; },
      toCloud: function (r) {
        return { id: detUuid("treasury", r.id), org_id: DATA.orgId(), local_id: r.id,
          name: r.name, type: r.type || "cash", account_no: r.accountNo || "",
          opening_balance: r.openingBalance || 0, balance: r.balance || 0,
          is_active: r.isActive !== false };
      },
      fromCloud: function (r) {
        return { id: r.local_id, name: r.name, type: r.type || "cash", accountNo: r.account_no || "",
          openingBalance: Number(r.opening_balance || 0), balance: Number(r.balance || 0),
          isActive: r.is_active !== false };
      }
    },
    accounts: {
      local: function () { return W.accounts; },
      toCloud: function (r) {
        var ob = Number(r.openingBalance || 0);
        return { id: detUuid("accounts", r.id), org_id: DATA.orgId(), local_id: r.id,
          code: r.code, name_ar: r.nameAr, type: r.type, parent_id: r.parentId || 0,
          opening_debit: ob < 0 ? 0 : ob, opening_credit: ob < 0 ? -ob : 0,
          balance: r.balance || 0, is_active: r.isActive !== false };
      },
      fromCloud: function (r) {
        return { id: r.local_id, code: r.code, nameAr: r.name_ar, type: r.type,
          parentId: Number(r.parent_id || 0),
          openingBalance: Number(r.opening_debit || 0) - Number(r.opening_credit || 0),
          balance: Number(r.balance || 0), isActive: r.is_active !== false };
      }
    },
    sales: {
      local: function () { return W.sales; },
      toCloud: function (r) {
        return {
          id: detUuid("sales", r.id),
          org_id: DATA.orgId(),
          local_id: r.id,
          invoice_no: r.invoiceNumber || r.invoiceNo || String(r.id),
          doc_date: r.invoiceDate || r.date || "",
          customer: r.customerName || r.customer || "",
          payment_method: r.paymentMethod || "",
          treasury_id: (r.treasuryId != null ? String(r.treasuryId) : ""),
          store: r.warehouse || r.store || "",
          notes: r.notes || "",
          discount: r.discountAmount || r.discount || 0,
          tax: r.taxAmount || r.tax || 0,
          grand_total: r.grandTotal || 0
        };
      },
      fromCloud: function (r) {
        return {
          id: r.local_id,
          invoiceNo: r.invoice_no,
          invoiceNumber: r.invoice_no,
          date: r.doc_date,
          invoiceDate: r.doc_date,
          customer: r.customer || "",
          customerName: r.customer || "",
          paymentMethod: r.payment_method || "",
          treasuryId: (r.treasury_id && !isNaN(Number(r.treasury_id))) ? Number(r.treasury_id) : (r.treasury_id || null),
          store: r.store || "",
          warehouse: r.store || "",
          notes: r.notes || "",
          discount: Number(r.discount || 0),
          discountAmount: Number(r.discount || 0),
          tax: Number(r.tax || 0),
          taxAmount: Number(r.tax || 0),
          grandTotal: Number(r.grand_total || 0),
          subTotal: Number(r.grand_total || 0) + Number(r.discount || 0) - Number(r.tax || 0),
          status: "posted",
          items: []
        };
      },
      itemsTable: "sale_items",
      itemFromCloud: function (r) {
        return {
          id: r.local_id,
          productId: r.product_id || "",
          nameAr: r.product_name || "",
          code: r.code || "",
          unit: r.unit || "",
          qty: Number(r.qty || 0),
          price: Number(r.price || 0),
          discount: Number(r.discount || 0),
          tax: Number(r.tax || 0),
          total: Number(r.total || 0)
        };
      },
      itemToCloud: function (sale) {
        return (sale.items || []).map(function (it, idx) {
          var itemId = it.id || (idx + 1);
          var uniqueLocalId = Number(sale.id) * 1000 + Number(itemId);
          return {
            id: detUuid("sale_items", uniqueLocalId),
            org_id: DATA.orgId(),
            local_id: uniqueLocalId,
            sale_id: detUuid("sales", sale.id),
            product_id: (it.productId || "").toString(),
            product_name: it.nameAr || "",
            qty: Number(it.qty || 0),
            price: Number(it.price || 0),
            total: Number(it.total || 0)
          };
        });
      }
    },
    purchases: {
      local: function () { return W.purchases; },
      toCloud: function (r) {
        return {
          id: detUuid("purchases", r.id),
          org_id: DATA.orgId(),
          local_id: r.id,
          invoice_no: r.invoiceNumber || r.invoiceNo || String(r.id),
          doc_date: r.invoiceDate || r.date || "",
          supplier: r.supplierName || r.supplier || "",
          payment_method: r.paymentMethod || "",
          treasury_id: (r.treasuryId != null ? String(r.treasuryId) : ""),
          store: r.warehouse || r.store || "",
          notes: r.notes || "",
          discount: r.discountAmount || r.discount || 0,
          tax: r.taxAmount || r.tax || 0,
          grand_total: r.grandTotal || 0
        };
      },
      fromCloud: function (r) {
        return {
          id: r.local_id,
          invoiceNo: r.invoice_no,
          invoiceNumber: r.invoice_no,
          date: r.doc_date,
          invoiceDate: r.doc_date,
          supplier: r.supplier || "",
          supplierName: r.supplier || "",
          paymentMethod: r.payment_method || "",
          treasuryId: (r.treasury_id && !isNaN(Number(r.treasury_id))) ? Number(r.treasury_id) : (r.treasury_id || null),
          store: r.store || "",
          warehouse: r.store || "",
          notes: r.notes || "",
          discount: Number(r.discount || 0),
          discountAmount: Number(r.discount || 0),
          tax: Number(r.tax || 0),
          taxAmount: Number(r.tax || 0),
          grandTotal: Number(r.grand_total || 0),
          subTotal: Number(r.grand_total || 0) + Number(r.discount || 0) - Number(r.tax || 0),
          status: "posted",
          items: []
        };
      },
      itemsTable: "purchase_items",
      itemFromCloud: function (r) {
        return {
          id: r.local_id,
          productId: r.product_id || "",
          nameAr: r.product_name || "",
          code: r.code || "",
          unit: r.unit || "",
          qty: Number(r.qty || 0),
          price: Number(r.price || 0),
          discount: Number(r.discount || 0),
          tax: Number(r.tax || 0),
          total: Number(r.total || 0)
        };
      },
      itemToCloud: function (pur) {
        return (pur.items || []).map(function (it, idx) {
          var itemId = it.id || (idx + 1);
          var uniqueLocalId = Number(pur.id) * 1000 + Number(itemId);
          return {
            id: detUuid("purchase_items", uniqueLocalId),
            org_id: DATA.orgId(),
            local_id: uniqueLocalId,
            purchase_id: detUuid("purchases", pur.id),
            product_id: (it.productId || "").toString(),
            product_name: it.nameAr || "",
            qty: Number(it.qty || 0),
            price: Number(it.price || 0),
            total: Number(it.total || 0)
          };
        });
      }
    },
    supplier_txs: {
      local: function () { return W.supplier_txs || []; },
      toCloud: function (r) {
        return { id: detUuid("supplier_txs", r.id), org_id: DATA.orgId(), local_id: r.id,
          supplier_id: (r.supplierId || "").toString(), doc_date: r.date || "",
          type: r.type || "", amount: r.amount || 0 };
      },
      fromCloud: function (r) {
        return { id: r.local_id, supplierId: Number(r.supplier_id || 0), date: r.doc_date,
          type: r.type || "", amount: Number(r.amount || 0) };
      }
    },
    customer_txs: {
      local: function () { return W.customer_txs || []; },
      toCloud: function (r) {
        return { id: detUuid("customer_txs", r.id), org_id: DATA.orgId(), local_id: r.id,
          customer_id: (r.customerId || "").toString(), doc_date: r.date || "",
          description: r.desc || "", debit: r.debit || 0, credit: r.credit || 0 };
      },
      fromCloud: function (r) {
        return { id: r.local_id, customerId: Number(r.customer_id || 0), date: r.doc_date,
          desc: r.description || "", debit: Number(r.debit || 0), credit: Number(r.credit || 0) };
      }
    },
    vouchers: {
      local: function () { return W.vouchers; },
      toCloud: function (r) {
        return { id: detUuid("vouchers", r.id), org_id: DATA.orgId(), local_id: r.id,
          no: r.no || r.id, doc_date: r.date || "", kind: r.kind || r.type || "in",
          treasury_id: (r.treasuryId || "").toString(), account_id: (r.accountId || "").toString(),
          amount: r.amount || 0, notes: r.notes || r.desc || "" };
      },
      fromCloud: function (r) {
        var k = r.kind || "in";
        return { id: r.local_id, no: r.no, date: r.doc_date, kind: k, type: k,
          treasuryId: Number(r.treasury_id || 0), accountId: Number(r.account_id || 0),
          amount: Number(r.amount || 0), desc: r.notes || "", notes: r.notes || "" };
      }
    },
    journal_entries: {
      local: function () { return W.journalEntries; },
      toCloud: function (r) {
        return { id: detUuid("journal_entries", r.id), org_id: DATA.orgId(), local_id: r.id,
          jrn_no: r.jrnNo || r.id, doc_date: r.date || "", ref_type: r.refType || "",
          ref_id: (r.refId || "").toString(), description: r.description || "" };
      },
      fromCloud: function (r) {
        return { id: r.local_id, jrnNo: r.jrn_no, date: r.doc_date, refType: r.ref_type || "",
          refId: r.ref_id, description: r.description || "", lines: [] };
      },
      itemsTable: "journal_lines",
      itemFromCloud: function (r) {
        return { id: r.local_id, accountId: Number(r.account_id || 0), accountName: r.account_name,
          debit: Number(r.debit || 0), credit: Number(r.credit || 0) };
      },
      itemToCloud: function (en) {
        return (en.lines || []).map(function (l) {
          return { id: detUuid("journal_lines", l.id), org_id: DATA.orgId(), local_id: l.id,
            entry_id: detUuid("journal_entries", en.id),
            account_id: (l.accountId || "").toString(), account_name: l.accountName || "",
            debit: l.debit || 0, credit: l.credit || 0 };
        });
      }
    }
  };

  var W = window.MIZAN_STATE || {};
  // ربط الحالة (نضع الحيوانات في window حتى تتمكن app من ملء المرجع)
  window.MIZAN_STATE = W;

  function syncOne(name) {
    var meta = META[name];
    if (!meta || !DATA.isOnline() || !DATA.client()) return Promise.resolve();
    var local = meta.local();
    var client = DATA.client();
    return client.from(name).select("local_id").then(function (res) {
      if (res.error) return; 
      var have = res.data || [];
      var localIds = local.map(function (r) { return Number(r.id); });
      var drop = [];
      have.forEach(function (r) {
        if (r && r.local_id != null && localIds.indexOf(Number(r.local_id)) === -1) drop.push(r.local_id);
      });
      var rows = local.map(function (r) {
        var row = meta.toCloud(r);
        if (W.idMap && W.idMap[name] && W.idMap[name][Number(r.id)]) row.id = W.idMap[name][Number(r.id)];
        return row;
      });
      // حماية: لو المحذوف كتير جدًا (أكتر من نص الجدول في السحابة) يبقى فين كذا
      // (مثل ما تكون بيانات جهاز اتضاعت) → نتجاهل الحذف ونحفظ بس
      if (drop.length > 0 && drop.length > Math.ceil((have.length || 0) / 2)) {
        drop = [];
      }
      var chain = Promise.resolve();
      if (drop.length) {
        chain = client.from(name).delete().in("local_id", drop);
      }
      if (rows.length) {
        chain = chain.then(function () {
          return client.from(name).upsert(rows, { onConflict: "org_id,local_id" }).then(function (u) {
            if (u.error) throw u.error;
          });
        });
      }
      return chain.then(function () { return syncItems(name, meta); });
    });
  }

  function syncItems(name, meta) {
    var itemsTable = meta.itemsTable;
    if (!itemsTable) return Promise.resolve();
    var client = DATA.client();
    var parent = meta.local();
    var items = [];
    parent.forEach(function (p) {
      var mapped = meta.itemToCloud(p);
      if (Array.isArray(mapped)) items = items.concat(mapped);
    });
    items = items.filter(Boolean);
    return client.from(itemsTable).select("local_id").then(function (res) {
      if (res.error) return;
      var have = res.data || [];
      var localIds = items.map(function (r) { return Number(r.local_id); });
      var drop = [];
      have.forEach(function (r) { if (r.local_id != null && localIds.indexOf(Number(r.local_id)) === -1) drop.push(r.local_id); });
      if (drop.length > 0 && drop.length > Math.ceil((have.length || 0) / 2)) { drop = []; }
      var chain = Promise.resolve();
      if (drop.length) { chain = client.from(itemsTable).delete().in("local_id", drop); }
      if (items.length) {
        chain = chain.then(function () {
          return client.from(itemsTable).upsert(items, { onConflict: "org_id,local_id" }).then(function (u) { if (u.error) throw u.error; });
        });
      }
      return chain;
    });
  }

  function push(name) {
    var t = syncOne(name);
    t.catch(function (e) { console.warn("sync", name, e.message); });
    return t;
  }

  // تحميل كل الجداول إلى الحالة المحلية
  function loadAll() {
    W.idMap = W.idMap || {};
    var names = ["customers", "suppliers", "products", "treasury", "accounts"];
    var eagerLoad = DATA.loadEagerAll ? DATA.loadEagerAll() : null;
    var eagerFallback = eagerLoad ? null : function (n) {
      return DATA.client().from(n).select("*").order("created_at").then(function (r) { return [n, r.error ? [] : (r.data || [])]; });
    };
    return (eagerLoad || Promise.all(names.map(eagerFallback))).then(function (all) {
      var arr = {};
      if (eagerLoad && all) { names.forEach(function (n) { arr[n] = all[n] || []; }); }
      if (!eagerLoad && all) { all.forEach(function (pair) { arr[pair[0]] = pair[1]; }); }
      names.forEach(function (n) {
        var rows = arr[n] || [];
        var out = rows.map(function (r) { return META[n].fromCloud(r); }).filter(function (x) { return x.id != null; });
        // تسجيل الخريطة local_id -> uuid للسطور الموجودة فعلًا
        rows.forEach(function (r) {
          if (r.local_id != null) { W.idMap[n] = W.idMap[n] || {}; W.idMap[n][Number(r.local_id)] = r.id; }
        });
        assignLocalIds(n, out);
        W[n] = out;
      });
      return loadLazyAll().then(function () { return true; });
    });
  }

  function assignLocalIds(table, arr) {
    // السطور بدون رقم محلي (فقط إن وجدت) تُرقّم وتحفظ ترقيمها
    var ids = arr.map(function (r) { return Number(r.id); }).filter(function (x) { return !isNaN(x) && x > 0; });
    var max = ids.length ? Math.max.apply(null, ids) : 0;
    arr.forEach(function (r) {
      if (r.id == null || isNaN(Number(r.id)) || Number(r.id) <= 0) {
        max++;
        r.id = max;
        W.pendingLocalIds = W.pendingLocalIds || {};
        W.pendingLocalIds[table] = W.pendingLocalIds[table] || {};
        W.pendingLocalIds[table][max] = true;
      }
    });
  }

  function loadLazyAll() {
    var lazy = ["sales", "purchases", "supplier_txs", "customer_txs", "vouchers", "journal_entries"];
    var tasks = lazy.map(function (n) {
      return DATA.loadLazy(n).then(function (rows) {
        if (n === "journal_entries") {
          return DATA.loadLazy("journal_lines").then(function (lines) {
            W.journalEntries = (rows || []).map(function (r) { return META.journal_entries.fromCloud(r); });
            // إلحاق الأسطر
            var byEntry = {};
            (lines || []).forEach(function (l) { byEntry[l.entry_id] = byEntry[l.entry_id] || []; byEntry[l.entry_id].push(l); });
            W.journalEntries.forEach(function (en) {
              var eid = detUuid("journal_entries", en.id);
              (byEntry[eid] || []).forEach(function (l) { en.lines.push(META.journal_entries.itemFromCloud(l)); });
            });
            return;
          });
        }
        var out = (rows || []).map(function (r) { return META[n].fromCloud(r); }).filter(function (x) { return x.id != null; });
        W[n] = out;
      });
    });
    return Promise.all(tasks).then(function () {
      // إلحاق الأصناف بالفوترة (سمع/purchase)
      return Promise.all(["sales", "purchases"].map(function (n) {
        var meta = META[n].itemsTable;
        return DATA.loadLazy(meta).then(function (rows) {
          var arr = W[n];
          var byParent = {};
          (rows || []).forEach(function (r) {
            var parentId = r.sale_id || r.purchase_id;
            byParent[parentId] = byParent[parentId] || [];
            byParent[parentId].push(r);
          });
          arr.forEach(function (doc) {
            var pid = detUuid(n, doc.id);
            (byParent[pid] || []).forEach(function (it) {
              doc.items.push(META[n].itemFromCloud(it));
            });
          });
        }).catch(function () { });
      }));
    });
  }

  window.CLOUD = {
    push: push,
    loadAll: loadAll,
    detUuid: detUuid,
    state: W,
    META: META,
    needsSeed: function () {
      return Object.keys(W.pendingLocalIds || {}).length > 0;
    }
  };
})();