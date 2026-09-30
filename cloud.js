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
  // 🆕 ترحيل ٣٤: استرجاع الرقم المحلي من الـ uuid.detUuid رقم حتمي آخر ١٢ خانة فيه = الرقم المحلي.
  //    لو السطر فقد local_id على السحابة (ده كان بيحصل من شاشة الضبط)، بنعيد الرقم من الـ id
  //    ourselves — بس بعد ما نتأكد إن الـ id فعلاً متولّد من نفس الرقم (مش uuid عشوائي).
  function localIdFromUuid(table, id) {
    if (!id || typeof id !== "string") return null;
    var parts = id.split("-");
    var tail = parts[parts.length - 1];
    if (!/^[0-9a-f]{12}$/.test(tail)) return null;
    var n = parseInt(tail, 16);
    if (!isFinite(n) || n <= 0 || n > 1000000) return null;      // الأرقام العشوائية بتبقى ضخمة
    return detUuid(table, n) === id.toLowerCase() ? n : null;     // إثبات إن الرقم ده مصدر الـ id
  }

  // تاريخ المستند: النص الفاضي بيكسر عمود date في السحابة (والدورة كلها بتفشل) → بلا تاريخ = null
  function docDate(r) {
    var d = r.invoiceDate || r.date || r.returnDate || r.docDate || "";
    d = String(d).trim();
    return d ? d.slice(0, 10) : null;
  }

  // 🔗 رقم الطرف (عميل/مورد/صنف/خزينة) بين الأجهزة: بيتخزن كنص = local_id بتاعه.
  //    من غير الرقم ده الجهاز التاني بيشوف الاسم بس → الفاتورة بتقطع صلة صاحبها،
  //    والمتاح للرجوع ووسم المرتجع وكشف حساب الفاتورة كلهم بيتعطلوا.
  function localIdStr(v) {
    if (v === null || v === undefined || v === "") return "";
    var n = Number(v);
    return isNaN(n) ? String(v) : String(n);
  }
  function localIdNum(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

  // 🧾 رقم سطر الصنف جوه الفاتورة: على السحابة بيخزن مركّب (رقم الأب × 1000 + ترتيب السطر)
  //    عشان ما يتعارضش مع فاتورة تانية. هنا نفكّه لرقم السطر الأصلي (1، 2، 3...).
  //    السطور القديمة اللي أرقامها صغيرة بتفضل زي ما هي.
  function decodeItemLocalId(v) {
    var lid = Number(v) || 0;
    if (!lid) return lid;
    return (lid % 1000) || lid;
  }

  // عمود الأب في كل جدول أصناف/أسطر
  var PARENT_OF = {
    sale_items: "sale_id", purchase_items: "purchase_id",
    sale_return_items: "return_id", purchase_return_items: "return_id",
    journal_lines: "entry_id"
  };

  // 🗂 السطور اللي الجهاز ده شافها فعلًا في آخر تنزيل (local_id -> uuid السحابي).
  // الحذف السحابي بيتم بس للسطور دي: جهاز ما يشوفش سطر قط لا يمسحه.
  function seenIds(name) {
    var m = (W.idMap && W.idMap[name]) || {};
    var s = {};
    Object.keys(m).forEach(function (k) { if (m[k]) s[m[k]] = 1; });
    return s;
  }
  function rememberIds(name, rows) {
    W.idMap = W.idMap || {};
    var m = W.idMap[name] || (W.idMap[name] = {});
    (rows || []).forEach(function (r) {
      if (r && r.id != null && r.local_id != null) m[Number(r.local_id)] = r.id;
    });
  }
  // 🛡 حد أقصى للحذف في عملية واحدة (حماية لو جهاز حاله ناقص)
  function capDeletes(what, count, haveCount) {
    var max = Math.max(5, Math.floor((haveCount || 0) * 0.25));
    if (count > max) {
      console.warn("sync guard: تجاوز حد الحذف الآمن", what, count, haveCount);
      return false;
    }
    return true;
  }
  // 🛡🛡 حارس «المسح الكامل»: جهاز حاله فاضي خالص والسحابة فيها أكتر من سطر = ده مش مستخدم
  //    مسح مستنداته، ده جهاز فقد بياناته (أو لسه ما نزّلش). في الحالة دي مابنمسحش حاجة،
  //    والسحابة هي اللي ترجّع البيانات للجهاز. الحذف العادي (سطر/سطرين من جدول فيه بيانات)
  //    بيتم عادي — ولو فضل سطر واحد على السحابة حذفه بيتزامن.
  function wipeGuard(what, localCount, haveCount) {
    if (Number(localCount) === 0 && Number(haveCount) > 1) {
      console.warn("sync guard: الجهاز فاضي والسحابة فيها " + haveCount + " سطر من " + what + " — الحذف موقوف");
      try { if (DATA.onWipeBlocked) DATA.onWipeBlocked(what, haveCount); } catch (e) { }
      return false;
    }
    return true;
  }
  // ⚠️ فشل المزامنة كان بيكتب في console بس → المستخدم ما يعرفش. دلوقتي يوصل لتنبيه ودّي.
  function syncFailed(what, err) {
    console.warn("sync", what, err && err.message ? err.message : err);
    try { if (DATA.onSyncError) DATA.onSyncError(what, err); } catch (e) { }
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
        // ترحيل ٣٤: السطر اللي فقد local_id على السحابة يسترجعه من الـ uuid بدل ما يتشال
        // من القائمة ويعاد ترقيمه من جديد في كل تحميل (ده كان بيولّد التكرار).
        var lid = (r.local_id != null) ? Number(r.local_id) : localIdFromUuid("treasury", r.id);
        return { id: lid, name: r.name, type: r.type || "cash", accountNo: r.account_no || "",
          openingBalance: Number(r.opening_balance || 0), balance: Number(r.balance || 0),
          isActive: r.is_active !== false };
      }
    },
    // 🆕 بناء 115: الموظفون — نفس نمط الهوية (detUuid + local_id) من ترحيل ٣٤/جدول employees في ترحيل ٣٥
    employees: {
      local: function () { return W.employees || []; },
      toCloud: function (r) {
        return { id: detUuid("employees", r.id), org_id: DATA.orgId(), local_id: r.id,
          code: r.code || "", name_ar: r.nameAr || "", job_title: r.jobTitle || "",
          department: r.department || "", phone: r.phone || "", hire_date: r.hireDate || null,
          is_active: r.isActive !== false, badge: r.badge || "", notes: r.notes || "",
          deleted: false };
      },
      fromCloud: function (r) {
        var lid = (r.local_id != null) ? Number(r.local_id) : localIdFromUuid("employees", r.id);
        return { id: lid, code: r.code || "", nameAr: r.name_ar || "", jobTitle: r.job_title || "",
          department: r.department || "", phone: r.phone || "", hireDate: r.hire_date || "",
          isActive: r.is_active !== false, badge: r.badge || "", notes: r.notes || "" };
      }
    },
    // 🆕 بناء 115: سجل الحضور — سطر لكل موظف/يوم (الفهرس السحابي uq_attendance_empday يمنع المزدوج)
    attendance: {
      local: function () { return W.attendance || []; },
      toCloud: function (r) {
        return { id: detUuid("attendance", r.id), org_id: DATA.orgId(), local_id: r.id,
          employee_id: Number(r.employeeId), att_date: r.date,
          check_in: r.checkIn || null, check_out: r.checkOut || null,
          status: r.status || "present",
          late_min: Math.round(Number(r.lateMin) || 0), early_min: Math.round(Number(r.earlyMin) || 0),
          work_min: Math.round(Number(r.workMin) || 0), ot_min: Math.round(Number(r.otMin) || 0),
          auto_timed: r.autoTimed !== false, note: r.note || "", user_name: r.userName || "" };
      },
      fromCloud: function (r) {
        var lid = (r.local_id != null) ? Number(r.local_id) : localIdFromUuid("attendance", r.id);
        return { id: lid, employeeId: Number(r.employee_id), date: String(r.att_date || "").slice(0, 10),
          checkIn: r.check_in || null, checkOut: r.check_out || null,
          status: r.status || "present",
          lateMin: Number(r.late_min || 0), earlyMin: Number(r.early_min || 0),
          workMin: Number(r.work_min || 0), otMin: Number(r.ot_min || 0),
          autoTimed: r.auto_timed !== false, note: r.note || "", userName: r.user_name || "" };
      }
    },
    // 🆕 بناء 115: مدة العمل — سطر واحد لكل شركة (تلفّه app.js في مصفوفة عند المراية)
    att_settings: {
      local: function () { return W.att_settings || []; },
      toCloud: function (r) {
        return { id: detUuid("att_settings", r.id || 1), org_id: DATA.orgId(), local_id: r.id || 1,
          work_start: r.workStart || "09:00", work_end: r.workEnd || "17:00",
          grace_min: Math.round(Number(r.graceMin) || 0), lunch_min: Math.round(Number(r.lunchMin) || 0) };
      },
      fromCloud: function (r) {
        var lid = (r.local_id != null) ? Number(r.local_id) : (localIdFromUuid("att_settings", r.id) || 1);
        return { id: lid, workStart: r.work_start || "09:00", workEnd: r.work_end || "17:00",
          graceMin: Number(r.grace_min || 0), lunchMin: Number(r.lunch_min || 0) };
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
          doc_date: docDate(r),
          customer: r.customerName || r.customer || "",
          customer_id: localIdStr(r.customerId),
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
          customerId: localIdNum(r.customer_id),
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
          id: decodeItemLocalId(r.local_id),
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
            unit: it.unit || "",
            code: it.code || "",
            discount: Number(it.discount || 0),
            tax: Number(it.tax || 0),
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
          doc_date: docDate(r),
          supplier: r.supplierName || r.supplier || "",
          supplier_id: localIdStr(r.supplierId),
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
          supplierId: localIdNum(r.supplier_id),
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
          id: decodeItemLocalId(r.local_id),
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
            unit: it.unit || "",
            code: it.code || "",
            discount: Number(it.discount || 0),
            tax: Number(it.tax || 0),
            qty: Number(it.qty || 0),
            price: Number(it.price || 0),
            total: Number(it.total || 0)
          };
        });
      }
    },
    // ============ المرتجعات (بناء 108) ============
    // نفس نمط الفواتير بالظبط: سطر رئيسي + أصناف، ومعرّف ثابت (detUuid)
    // عشان الجهاز التاني ما يكررش السطر.
    sale_returns: {
      local: function () { return W.sale_returns || []; },
      toCloud: function (r) {
        return {
          id: detUuid("sale_returns", r.id), org_id: DATA.orgId(), local_id: r.id,
          return_no: r.returnNumber || r.returnNo || String(r.id),
          doc_date: docDate(r),
          sale_local_id: (r.saleId != null && !isNaN(Number(r.saleId))) ? Number(r.saleId) : null,
          customer: r.customerName || r.customer || "",
          customer_id: localIdStr(r.customerId),
          settlement: r.settlement || "",
          payment_method: r.paymentMethod || "",
          treasury_id: (r.treasuryId != null ? String(r.treasuryId) : ""),
          store: r.warehouse || r.store || "",
          notes: r.notes || "",
          grand_total: r.grandTotal || 0
        };
      },
      fromCloud: function (r) {
        return {
          id: r.local_id,
          returnNo: r.return_no, returnNumber: r.return_no,
          date: r.doc_date, returnDate: r.doc_date,
          saleId: (r.sale_local_id == null ? null : Number(r.sale_local_id)),
          customerId: localIdNum(r.customer_id),
          customer: r.customer || "", customerName: r.customer || "",
          settlement: r.settlement || "",
          paymentMethod: r.payment_method || "",
          treasuryId: (r.treasury_id && !isNaN(Number(r.treasury_id))) ? Number(r.treasury_id) : (r.treasury_id || null),
          store: r.store || "", warehouse: r.store || "",
          notes: r.notes || "",
          grandTotal: Number(r.grand_total || 0),
          status: "posted",
          items: []
        };
      },
      itemsTable: "sale_return_items",
      itemFromCloud: function (r) {
        // local_id = رقم المرتجع ×1000 + رقم السطر → نرجّعه لرقم السطر عشان إعادة الدفع ما تكررش الأصناف
        return {
          id: decodeItemLocalId(r.local_id),
          productId: r.product_id || "", nameAr: r.product_name || "",
          unit: r.unit || "", code: r.code || "",
          discount: Number(r.discount || 0), tax: Number(r.tax || 0),
          qty: Number(r.qty || 0), price: Number(r.price || 0), total: Number(r.total || 0)
        };
      },
      itemToCloud: function (ret) {
        return (ret.items || []).map(function (it, idx) {
          var itemId = it.id || (idx + 1);
          var uniqueLocalId = Number(ret.id) * 1000 + Number(itemId);
          return {
            id: detUuid("sale_return_items", uniqueLocalId),
            org_id: DATA.orgId(), local_id: uniqueLocalId,
            return_id: detUuid("sale_returns", ret.id),
            product_id: (it.productId || "").toString(),
            product_name: it.nameAr || "",
            unit: it.unit || "", code: it.code || "",
            discount: Number(it.discount || 0), tax: Number(it.tax || 0),
            qty: Number(it.qty || 0), price: Number(it.price || 0), total: Number(it.total || 0)
          };
        });
      }
    },
    purchase_returns: {
      local: function () { return W.purchase_returns || []; },
      toCloud: function (r) {
        return {
          id: detUuid("purchase_returns", r.id), org_id: DATA.orgId(), local_id: r.id,
          return_no: r.returnNumber || r.returnNo || String(r.id),
          doc_date: docDate(r),
          purchase_local_id: (r.purchaseId != null && !isNaN(Number(r.purchaseId))) ? Number(r.purchaseId) : null,
          supplier: r.supplierName || r.supplier || "",
          supplier_id: localIdStr(r.supplierId),
          settlement: r.settlement || "",
          payment_method: r.paymentMethod || "",
          treasury_id: (r.treasuryId != null ? String(r.treasuryId) : ""),
          store: r.warehouse || r.store || "",
          notes: r.notes || "",
          grand_total: r.grandTotal || 0
        };
      },
      fromCloud: function (r) {
        return {
          id: r.local_id,
          returnNo: r.return_no, returnNumber: r.return_no,
          date: r.doc_date, returnDate: r.doc_date,
          purchaseId: (r.purchase_local_id == null ? null : Number(r.purchase_local_id)),
          supplierId: localIdNum(r.supplier_id),
          supplier: r.supplier || "", supplierName: r.supplier || "",
          settlement: r.settlement || "",
          paymentMethod: r.payment_method || "",
          treasuryId: (r.treasury_id && !isNaN(Number(r.treasury_id))) ? Number(r.treasury_id) : (r.treasury_id || null),
          store: r.store || "", warehouse: r.store || "",
          notes: r.notes || "",
          grandTotal: Number(r.grand_total || 0),
          status: "posted",
          items: []
        };
      },
      itemsTable: "purchase_return_items",
      itemFromCloud: function (r) {
        // local_id = رقم المرتجع ×1000 + رقم السطر → نفكّه لرقم السطر (زي جدول الفاتورة بالظبط)
        return {
          id: decodeItemLocalId(r.local_id),
          productId: r.product_id || "", nameAr: r.product_name || "",
          unit: r.unit || "", code: r.code || "",
          discount: Number(r.discount || 0), tax: Number(r.tax || 0),
          qty: Number(r.qty || 0), price: Number(r.price || 0), total: Number(r.total || 0)
        };
      },
      itemToCloud: function (ret) {
        return (ret.items || []).map(function (it, idx) {
          var itemId = it.id || (idx + 1);
          var uniqueLocalId = Number(ret.id) * 1000 + Number(itemId);
          return {
            id: detUuid("purchase_return_items", uniqueLocalId),
            org_id: DATA.orgId(), local_id: uniqueLocalId,
            return_id: detUuid("purchase_returns", ret.id),
            product_id: (it.productId || "").toString(),
            product_name: it.nameAr || "",
            unit: it.unit || "", code: it.code || "",
            discount: Number(it.discount || 0), tax: Number(it.tax || 0),
            qty: Number(it.qty || 0), price: Number(it.price || 0), total: Number(it.total || 0)
          };
        });
      }
    },
    supplier_txs: {
      local: function () { return W.supplier_txs || []; },
      toCloud: function (r) {
        return { id: detUuid("supplier_txs", r.id), org_id: DATA.orgId(), local_id: r.id,
          supplier_id: localIdStr(r.supplierId), doc_date: docDate(r),
          type: r.type || "", amount: r.amount || 0,
          description: r.desc || r.description || "",
          debit: r.debit || 0, credit: r.credit || 0 };
      },
      fromCloud: function (r) {
        // السطور القديمة مفيهاش debit/credit (اتسجلت نوع/مبلغ بس) → نشتقهم
        var d = Number(r.debit || 0), c = Number(r.credit || 0);
        if (!d && !c && r.amount) {
          if (String(r.type || "").indexOf("مرتجع") !== -1 || String(r.description || "").indexOf("مرتجع") !== -1) c = Number(r.amount);
          else d = Number(r.amount);
        }
        return { id: r.local_id, supplierId: localIdNum(r.supplier_id), date: r.doc_date,
          createdAt: r.created_at || null,
          type: r.type || "", amount: Number(r.amount || 0),
          desc: r.description || "", debit: d, credit: c };
      }
    },
    customer_txs: {
      local: function () { return W.customer_txs || []; },
      toCloud: function (r) {
        return { id: detUuid("customer_txs", r.id), org_id: DATA.orgId(), local_id: r.id,
          customer_id: localIdStr(r.customerId), doc_date: docDate(r),
          description: r.desc || "", debit: r.debit || 0, credit: r.credit || 0 };
      },
      fromCloud: function (r) {
        return { id: r.local_id, customerId: localIdNum(r.customer_id), date: r.doc_date,
          createdAt: r.created_at || null,
          desc: r.description || "", debit: Number(r.debit || 0), credit: Number(r.credit || 0) };
      }
    },
    vouchers: {
      local: function () { return W.vouchers; },
      toCloud: function (r) {
        return { id: detUuid("vouchers", r.id), org_id: DATA.orgId(), local_id: r.id,
          no: r.no || r.id, doc_date: docDate(r), kind: r.kind || r.type || "in",
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
          jrn_no: r.jrnNo || r.id, doc_date: docDate(r), ref_type: r.refType || "",
          ref_id: (r.refId || "").toString(), description: r.description || "" };
      },
      fromCloud: function (r) {
        return { id: r.local_id, jrnNo: r.jrn_no, date: r.doc_date, refType: r.ref_type || "",
          refId: r.ref_id, description: r.description || "", lines: [] };
      },
      itemsTable: "journal_lines",
      itemFromCloud: function (r) {
        return { id: decodeItemLocalId(r.local_id), accountId: Number(r.account_id || 0), accountName: r.account_name,
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

  // ============ رفع جدول للسحابة ============
  // القواعد الجديدة (بناء ١٠٨):
  //  ١) مفتاح السطر السحابي (id) بيتقرأ من السحابة وميتكتبش من جديد — إعادة كتابة id
  //     كانت بتيتّم أسطر الأصناف وبنقلت سطور لفواتير تانية.
  //  ٢) الحذف بيتم بس للسطور اللي الجهاز ده شافها في آخر تنزيل، وبكمية محدودة.
  function syncOne(name) {
    var meta = META[name];
    if (!meta || !DATA.isOnline() || !DATA.client()) return Promise.resolve();
    var local = meta.local() || [];
    var client = DATA.client();
    return client.from(name).select("id, local_id").then(function (res) {
      if (res.error) { syncFailed(name, res.error); return; }
      var have = res.data || [];
      var cloudId = {};                                  // local_id -> uuid الموجود على السحابة
      have.forEach(function (r) { if (r && r.local_id != null) cloudId[Number(r.local_id)] = r.id; });
      var seen = seenIds(name);
      var localIds = local.map(function (r) { return Number(r.id); });
      var drop = [];
      have.forEach(function (r) {
        if (!r || r.local_id == null) return;
        if (localIds.indexOf(Number(r.local_id)) !== -1) return;
        if (seen[r.id]) drop.push(r.local_id);           // (٢) اللي مانشوفوش ما نمسحوش
      });
      var rows = local.map(function (r) {
        var row = meta.toCloud(r);
        var k = Number(r.id);
        if (cloudId[k] != null) row.id = cloudId[k];     // (١) نلبس السطر نفس رقمه السحابي
        else if (W.idMap && W.idMap[name] && W.idMap[name][k]) row.id = W.idMap[name][k];
        return row;
      });
      // حماية إضافية: المحذوف ما يزيدش عن ربع الجدول، والممسوحش لما الجهاز حاله فاضي
      if (drop.length && !wipeGuard(name, local.length, have.length)) drop = [];
      if (drop.length && !capDeletes(name, drop.length, have.length)) drop = [];
      var chain = Promise.resolve();
      if (drop.length) {
        chain = client.from(name).delete().in("local_id", drop).then(function (d) {
          if (d && d.error) syncFailed(name, d.error);
        });
      }
      if (rows.length) {
        chain = chain.then(function () {
          // 🆕 ترحيل ٣٤: الحكم هو المفتاح الأساسي (id). السطور اللي فقدت local_id على السحابة
          // ما بتتطابقش مع on conflict (org_id, local_id) فتتحول لـ INSERT بيصطدم بـ treasury_pkey
          // (خطأ 23505) ⇒ الدفعة كلها تفشل ⇒ رسالة «رفع «الخزائن» للسحابة مكملش دلوقتي».
          // بـ "id": نفس السطر بيتحدّث وlocal_id المرجّح بيتكتب من جديد (السطر بيقوم بصلح نفسه).
          // ولو حصل تصادم على فهرس تاني (نفس org_id+local_id برقمين مختلفين) نرجع للطريقة القديمة.
          return client.from(name).upsert(rows, { onConflict: "id" }).then(function (u) {
            if (u && u.error) {
              var code = String((u.error && u.error.code) || "");
              var msg = String((u.error && u.error.message) || "");
              if (code === "23505" || /duplicate key/i.test(msg)) {
                return client.from(name).upsert(rows, { onConflict: "org_id,local_id" }).then(function (u2) {
                  if (u2 && u2.error) throw u2.error;
                });
              }
              throw u.error;
            }
          });
        });
      }
      return chain.then(function () {
        rememberIds(name, rows);
        rows.forEach(function (r) { if (cloudId[Number(r.local_id)] == null) cloudId[Number(r.local_id)] = r.id; });
        return syncItems(name, meta, cloudId);
      }).catch(function (e) { syncFailed(name, e); });
    });
  }

  // ============ رفع أسطر الأصناف ============
  // هوية السطر = (رقم أبيه السحابي + ترتيبه جوه أبوه). مافيش رقم مركّب مشترك بين فاتورتين.
  function syncItems(name, meta, cloudId) {
    var itemsTable = meta.itemsTable;
    if (!itemsTable) return Promise.resolve();
    var client = DATA.client();
    var parentField = meta.itemsParentField || PARENT_OF[itemsTable];
    if (!parentField) return Promise.resolve();
    var ids = cloudId || {};
    var items = [];
    (meta.local() || []).forEach(function (p) {
      var pUuid = ids[Number(p.id)];
      if (!pUuid) return;                               // أبوه لسه ما اترفعش → نستنى دورته
      var mapped = meta.itemToCloud(p);
      if (!Array.isArray(mapped)) return;
      mapped.forEach(function (row, idx) {
        if (!row) return;
        row.local_id = Number(p.id) * 1000 + (idx + 1);
        row[parentField] = pUuid;
        row.id = detUuid(itemsTable, row.local_id);
        row._pos = pUuid + ":" + (idx + 1);
        items.push(row);
      });
    });
    return client.from(itemsTable).select("id, local_id, " + parentField).then(function (res) {
      if (res.error) { syncFailed(itemsTable, res.error); return; }
      var have = res.data || [];
      // لو السطر ده موجود على السحابة في نفس الأب وبنفس ترتيبه → نستخدم رقمه القديم
      var byPos = {}, claimed = {};
      have.forEach(function (r) {
        if (!r || !r[parentField] || r.local_id == null) return;
        byPos[r[parentField] + ":" + (Number(r.local_id) % 1000)] = r.id;
      });
      items.forEach(function (row) {
        var old = !claimed[row._pos] ? byPos[row._pos] : null;
        if (old) { claimed[row._pos] = 1; row.id = old; }
      });
      var seen = seenIds(itemsTable);
      var keep = {};
      items.forEach(function (r) { keep[r.id] = 1; });
      var drop = [];
      have.forEach(function (r) { if (r && !keep[r.id] && seen[r.id]) drop.push(r.id); });
      if (drop.length && !wipeGuard(itemsTable, items.length, have.length)) drop = [];
      if (drop.length && !capDeletes(itemsTable, drop.length, have.length)) drop = [];
      var chain = Promise.resolve();
      if (drop.length) {
        chain = client.from(itemsTable).delete().in("id", drop).then(function (d) {
          if (d && d.error) syncFailed(itemsTable, d.error);
        });
      }
      if (items.length) {
        var payload = items.map(function (r) { delete r._pos; return r; });
        chain = chain.then(function () {
          return client.from(itemsTable).upsert(payload, { onConflict: "id" }).then(function (u) {
            if (u && u.error) throw u.error;
          });
        });
      }
      return chain.then(function () { rememberIds(itemsTable, items); })
        .catch(function (e) { syncFailed(itemsTable, e); });
    });

  }

  function push(name) {
    var t = syncOne(name);
    t.catch(function (e) { syncFailed(name, e); });
    return t;
  }

  // تحميل كل الجداول إلى الحالة المحلية
  function loadAll() {
    W.idMap = W.idMap || {};
    var names = ["customers", "suppliers", "products", "treasury", "accounts",
      "employees", "attendance", "att_settings"];
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
        var pairs = [];
        rows.forEach(function (r) {
          var loc = META[n].fromCloud(r);
          if (loc && loc.id != null) pairs.push({ loc: loc, raw: r });
          // تسجيل الخريطة local_id -> uuid للسطور الموجودة فعلًا
          if (r.local_id != null) { W.idMap[n] = W.idMap[n] || {}; W.idMap[n][Number(r.local_id)] = r.id; }
        });
        // 🆕 ترحيل ٣٤: سطران الخزنة بنفس الرقم المحلي = نفس الحساب اتكرّر على السحابة.
        // نعرض واحد منهم بس (اللي عليه local_id صريح) — ما نرقمش التاني من جديد،
        // لأن الترقيم الجديد كان بيولّد سطرًا ثالثًا في كل جلسة (ده كان بيت التكرار).
        if (n === "treasury") pairs = dedupeTreasury(pairs);
        // 🆕 بناء 115: الموظفون/الإعدادات — نفس منطق التكرار بالرقم المحلي (سطر واحد لكل رقم)
        if (n === "employees" || n === "att_settings") pairs = dedupeTreasury(pairs);
        // 🆕 بناء 115: الحضور — تكرار بالرقم المحلي + دمج سطرين لنفس الموظف في نفس اليوم
        if (n === "attendance") pairs = dedupeAttendance(pairs);
        assignLocalIds(n, pairs.map(function (p) { return p.loc; }));
        W[n] = pairs.map(function (p) { return p.loc; });
      });
      return loadLazyAll().then(function () { return true; });
    });
  }

  // 🆕 ترحيل ٣٤: إزالة تكرار أسطر الخزينة عند القراءة.
  // pairs = [{ loc: السطر المحلي, raw: سطر السحابة }] — بنفضّل السطر اللي عليه local_id صريح.
  function dedupeTreasury(pairs) {
    var byId = {}, kept = [];
    (pairs || []).forEach(function (p) {
      var k = Number(p.loc.id);
      var prev = byId[k];
      if (!prev) { byId[k] = p; kept.push(p); return; }
      var curExplicit = prev.raw && p.raw && p.raw.local_id != null && prev.raw.local_id == null;
      if (curExplicit) {
        var at = kept.indexOf(prev);
        if (at >= 0) kept[at] = p;
        byId[k] = p;
      }
    });
    return kept;
  }

  // 🆕 بناء ٣٥/115: تنقية سجل الحضور عند القراءة.
  // 1) سطران بنفس الرقم المحلي = نفس السطر اتكرّر ⇒ نفضّل اللي عليه local_id صريح (نفس منطق الخزنة).
  // 2) سطران لنفس الموظف في نفس اليوم (جهازان سجّلوا برقمين مختلفين قبل مزامنة بعضهما) ⇒
  //    نبقي رقمهم الأصغر (ثبات) ونلمّ الأوقات الناقصة من التاني — ما نرميش بيانات سجلت فعلًا.
  function dedupeAttendance(pairs) {
    var kept = dedupeTreasury(pairs);
    var map = {}, order = [];
    (kept || []).forEach(function (p) {
      if (!p || p.loc == null) return;
      var k = Number(p.loc.employeeId) + "|" + String(p.loc.date || "").slice(0, 10);
      if (!map[k]) { map[k] = p; order.push(k); return; }
      var cur = map[k];
      var base = Number(cur.loc.id) <= Number(p.loc.id) ? cur : p;
      var rest = base === cur ? p : cur;
      ["checkIn", "checkOut"].forEach(function (f) {
        if (!base.loc[f] && rest.loc[f]) base.loc[f] = rest.loc[f];
      });
      if (base.loc.status === "absent" && rest.loc.status && rest.loc.status !== "absent") {
        base.loc.status = rest.loc.status;
      }
      map[k] = base;
    });
    return order.map(function (k) { return map[k]; });
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
    var lazy = ["sales", "purchases", "supplier_txs", "customer_txs", "vouchers", "journal_entries",
      "sale_returns", "purchase_returns"];
    var tasks = lazy.map(function (n) {
      return DATA.loadLazy(n).then(function (rows) {
        rememberIds(n, rows);                            // عشان الحارس يعرف الجهاز ده شاف إيه
        if (n === "journal_entries") {
          return DATA.loadLazy("journal_lines").then(function (lines) {
            rememberIds("journal_lines", lines);
            W.journalEntries = (rows || []).map(function (r) { return META.journal_entries.fromCloud(r); });
            // إلحاق الأسطر
            var byEntry = {};
            (lines || []).forEach(function (l) { byEntry[l.entry_id] = byEntry[l.entry_id] || []; byEntry[l.entry_id].push(l); });
            W.journalEntries.forEach(function (en) {
              var eid = (W.idMap.journal_entries || {})[Number(en.id)];
              bySorted(byEntry[eid] || []).forEach(function (l) { en.lines.push(META.journal_entries.itemFromCloud(l)); });
            });
            return;
          });
        }
        var out = (rows || []).map(function (r) { return META[n].fromCloud(r); }).filter(function (x) { return x.id != null; });
        W[n] = out;
      });
    });
    return Promise.all(tasks).then(function () {
      // إلحاق الأصناف بالفواتير والمرتجعات — بالرقم السحابي الحقيقي للأب (مش مشتق)
      return Promise.all(["sales", "purchases", "sale_returns", "purchase_returns"].map(function (n) {
        var itemsTable = META[n].itemsTable;
        var parentField = PARENT_OF[itemsTable];
        return DATA.loadLazy(itemsTable).then(function (rows) {
          rememberIds(itemsTable, rows);
          var arr = W[n] || [];
          var byParent = {};
          (rows || []).forEach(function (r) {
            var parentId = r[parentField];
            byParent[parentId] = byParent[parentId] || [];
            byParent[parentId].push(r);
          });
          arr.forEach(function (doc) {
            var pid = (W.idMap[n] || {})[Number(doc.id)] || detUuid(n, doc.id);
            bySorted(byParent[pid] || []).forEach(function (it) {
              doc.items.push(META[n].itemFromCloud(it));
            });
          });
        }).catch(function (e) { syncFailed(itemsTable, e); });
      }));
    });
  }

  // ترتيب أسطر الصنف زي ما هي في الفاتورة الأصلية (الأقدم الأول)
  function bySorted(rows) {
    return rows.slice().sort(function (a, b) {
      return (Number(a.local_id) % 1000) - (Number(b.local_id) % 1000);
    });
  }

  // 🔢 تسلسل أرقام الفواتير لكل شركة (على السحابة) — الدوال مشتقة org من التوكن (current_org())
  function _sb() { return (DATA.client && DATA.client()) || null; }
  function _online() { return !!(DATA.isOnline && DATA.isOnline()) && !!_sb(); }

  function bumpInvoiceSeq(kind, value) {
    if (!_online()) return Promise.resolve();
    return Promise.resolve(_sb().rpc("mizan_bump_invoice_seq", { p_kind: String(kind), p_value: Number(value) || 0 }))
      .then(function (r) { if (r && r.error) console.warn("bumpInvoiceSeq", r.error.message); })
      .catch(function (e) { console.warn("bumpInvoiceSeq", e && e.message); });
  }
  function getInvoiceSeq() {
    if (!_online()) return Promise.resolve(null);
    return Promise.resolve(_sb().rpc("mizan_get_invoice_seq"))
      .then(function (r) {
        if (r && r.error) { console.warn("getInvoiceSeq", r.error.message); return null; }
        var out = {}; (r.data || []).forEach(function (row) { out[row.kind] = Number(row.last_value) || 0; });
        return out;
      }).catch(function () { return null; });
  }
  function nextInvoiceNo(kind) {
    if (!_online()) return Promise.resolve(null);
    return Promise.resolve(_sb().rpc("mizan_next_invoice_no", { p_kind: String(kind) }))
      .then(function (r) {
        if (r && r.error) { console.warn("nextInvoiceNo", r.error.message); return null; }
        return Number(r.data) || null;
      }).catch(function () { return null; });
  }

  window.CLOUD = {
    push: push,
    loadAll: loadAll,
    detUuid: detUuid,
    bumpInvoiceSeq: bumpInvoiceSeq,
    getInvoiceSeq: getInvoiceSeq,
    nextInvoiceNo: nextInvoiceNo,
    state: W,
    META: META,
    needsSeed: function () {
      return Object.keys(W.pendingLocalIds || {}).length > 0;
    }
  };
})();