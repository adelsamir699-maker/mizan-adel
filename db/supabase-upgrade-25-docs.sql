-- supabase-upgrade-25-docs.sql — ترحيل build 105: نظام إدارة المستندات (idempotent)
-- 1) جدول مستندات العملاء/الموردين (المسار النسبي فقط — بلا Absolute Path)
-- 2) جدول تقاعد الأرقام: كود العميل/المورد المحذوف لا يُعاد استخدامه أبدًا
--    (عشان مستندات Clients\1258 ما تظهرش لعميل جديد أخذ نفس الرقم)
-- 3) دوال RPC بصلاحيات:docManager صراحةً أو صاحب الشركة أو المالك

-- ===== 1) جدول المستندات =====
CREATE TABLE IF NOT EXISTS public.mizan_documents (
  doc_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_type text NOT NULL CHECK (party_type IN ('customer', 'supplier')),
  party_id   bigint,
  party_code text NOT NULL,            -- لقطة من كود العميل وقت الحفظ (لا يتغير بحذف العميل)
  file_name  text NOT NULL,
  file_ext   text,
  rel_path   text NOT NULL,            -- مثل: Clients\1258\001.pdf  (نسبي دائمًا)
  doc_type   text DEFAULT 'مستند عام',
  file_size  bigint DEFAULT 0,
  created_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, rel_path)
);

ALTER TABLE public.mizan_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mizan_docs_select ON public.mizan_documents;
CREATE POLICY mizan_docs_select ON public.mizan_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p
             WHERE p.id = auth.uid()
               AND (p.is_superadmin IS TRUE OR p.org_id = mizan_documents.org_id))
  );
-- لا سياسات INSERT/DELETE: الكتابة فقط عبر الدوال SECURITY DEFINER أدناه

CREATE INDEX IF NOT EXISTS mizan_docs_party_idx ON public.mizan_documents (org_id, party_type, party_code);

-- ===== 2) جدول تقاعد الأرقام =====
CREATE TABLE IF NOT EXISTS public.mizan_retired_codes (
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_type text NOT NULL CHECK (party_type IN ('customer', 'supplier')),
  code       text NOT NULL,
  retired_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, party_type, code)
);
ALTER TABLE public.mizan_retired_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mizan_retired_select ON public.mizan_retired_codes;
CREATE POLICY mizan_retired_select ON public.mizan_retired_codes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p
             WHERE p.id = auth.uid()
               AND (p.is_superadmin IS TRUE OR p.org_id = mizan_retired_codes.org_id))
  );

-- ===== 3) دوال =====

-- هل يملك المستدعي صلاحية إدارة المستندات؟ (صاحب الشركة / مالك النظام / عضو بصلاحية docManager صراحةً)
CREATE OR REPLACE FUNCTION public.mizan_doc_priv(p_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.is_superadmin IS TRUE
           OR (p.org_id = p_org AND p.role = 'admin')
           OR (p.org_id = p_org AND (p.features ->> 'docManager') = 'true'))
  );
$function$;

-- إضافة سجل مستند (تُستدعى فقط بعد نجاح حفظ الملف فعليًا على القرص)
CREATE OR REPLACE FUNCTION public.mizan_add_doc(
  p_party_type text, p_party_id bigint, p_party_code text,
  p_file_name text, p_ext text, p_rel text, p_type text, p_size bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE v_org uuid; v_id uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.profiles WHERE id = auth.uid();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'غير مصرح — الحساب بدون شركة';
  END IF;
  IF NOT public.mizan_doc_priv(v_org) THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  INSERT INTO public.mizan_documents
    (org_id, party_type, party_id, party_code, file_name, file_ext, rel_path, doc_type, file_size, created_by)
  VALUES
    (v_org, p_party_type, p_party_id, p_party_code, p_file_name, p_ext, p_rel, p_type, p_size,
     (SELECT split_part(au.email, '@', 1) FROM auth.users au WHERE au.id = auth.uid()))
  RETURNING doc_id INTO v_id;
  RETURN v_id;
END $function$;

-- قائمة مستندات جهة معينة (أو كلها) للشركة الحالية
CREATE OR REPLACE FUNCTION public.mizan_list_docs(p_party_type text DEFAULT NULL, p_party_code text DEFAULT NULL)
 RETURNS TABLE(doc_id uuid, party_type text, party_code text, file_name text, file_ext text,
               rel_path text, doc_type text, file_size bigint, created_by text, created_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT d.doc_id, d.party_type, d.party_code, d.file_name, d.file_ext,
         d.rel_path, d.doc_type, d.file_size, d.created_by, d.created_at
  FROM public.mizan_documents d
  WHERE (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_superadmin IS TRUE)
         OR d.org_id = (SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()))
    AND (p_party_type IS NULL OR d.party_type = p_party_type)
    AND (p_party_code IS NULL OR d.party_code = p_party_code)
  ORDER BY d.created_at DESC;
$function$;

-- حذف سجل المستند من القاعدة فقط (الملفات على القرص لا تُمس أبدًا هنا)
CREATE OR REPLACE FUNCTION public.mizan_del_doc(p_doc uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE v_org uuid; v_rel text;
BEGIN
  SELECT org_id, rel_path INTO v_org, v_rel FROM public.mizan_documents WHERE doc_id = p_doc;
  IF v_org IS NULL THEN RAISE EXCEPTION 'السجل غير موجود'; END IF;
  IF NOT public.mizan_doc_priv(v_org) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  DELETE FROM public.mizan_documents WHERE doc_id = p_doc;
  RETURN v_rel;
END $function$;

-- تقاعد رقم عميل/مورد محذوف
CREATE OR REPLACE FUNCTION public.mizan_retire_code(p_party_type text, p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.profiles WHERE id = auth.uid();
  IF v_org IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF p_party_type NOT IN ('customer', 'supplier') OR p_code IS NULL OR p_code = '' THEN
    RAISE EXCEPTION 'بيانات غير صالحة';
  END IF;
  INSERT INTO public.mizan_retired_codes (org_id, party_type, code)
  VALUES (v_org, p_party_type, p_code)
  ON CONFLICT (org_id, party_type, code) DO NOTHING;
END $function$;

-- قائمة الأرقام المتقاعدة (يدمجها الكود المحلي عند توليد رقم جديد)
CREATE OR REPLACE FUNCTION public.mizan_list_retired(p_party_type text)
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT code FROM public.mizan_retired_codes
  WHERE party_type = p_party_type
    AND org_id = (SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid());
$function$;

-- الرقم التالي الآمن: أكبر رقم مستخدم فعليًا + أكبر رقم متقاعد + 1 (يستحيل يعيد رقمًا متقاعدًا)
CREATE OR REPLACE FUNCTION public.mizan_next_code(p_party_type text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE v_org uuid; v_prefix text; v_max bigint := 0; v_ret bigint := 0;
BEGIN
  SELECT org_id INTO v_org FROM public.profiles WHERE id = auth.uid();
  IF v_org IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF p_party_type = 'customer' THEN
    v_prefix := 'CUST-';
    SELECT COALESCE(MAX((substring(code FROM '^CUST-(\d+)$'))::bigint), 0) INTO v_max
      FROM public.customers WHERE org_id = v_org;
  ELSIF p_party_type = 'supplier' THEN
    v_prefix := 'SUPP-';
    SELECT COALESCE(MAX((substring(code FROM '^SUPP-(\d+)$'))::bigint), 0) INTO v_max
      FROM public.suppliers WHERE org_id = v_org;
  ELSE
    RAISE EXCEPTION 'نوع غير معروف';
  END IF;
  SELECT COALESCE(MAX((substring(code FROM '^\w+-(\d+)$'))::bigint), 0) INTO v_ret
    FROM public.mizan_retired_codes WHERE org_id = v_org AND party_type = p_party_type;
  RETURN v_prefix || lpad((GREATEST(v_max, v_ret) + 1)::text, 4, '0');
END $function$;

-- ===== 4) الصلاحيات =====
GRANT EXECUTE ON FUNCTION public.mizan_doc_priv(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mizan_add_doc(text, bigint, text, text, text, text, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mizan_list_docs(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mizan_del_doc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mizan_retire_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mizan_list_retired(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mizan_next_code(text) TO authenticated;
