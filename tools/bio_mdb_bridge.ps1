# =====================================================================
#  Mizan — جسر ملف البصمة (att2000.mdb / ZKTime)   tools/bio_mdb_bridge.ps1
#  بيتنادى من server.js (مسارات /api/bio/*) بـ PowerShell 32-بت، لأن مشغّل
#  Access (Microsoft.ACE.OLEDB.12.0) مسجّل عند 32-بت بس على الجهاز ده.
#
#  أمان ملزم:
#   · كل الأفعال read-only على ملف الأكسيس (Mode=Read) — مافيش أي كتابة على ملف
#     العميل الأصلي أبدًا؛ النسخة الطابقة للأصل بتتحفظ كملف جديد في مجلد الباك أب.
#   · أي عمود فيه سرّ (باسورد الجهاز / PIN / كارت) بيتمحى من التصدير، والصور
#     وقوالب البصمات (byte[]) بتتحول لحجمها بس — غير لو صرّح بـ -WithBinary.
#   · الإخراج JSON واحد على stdout عشان server.js يقرأه، والأخطاء JSON + exit 1.
#
#  أفعال: probe | list | export | copy
# =====================================================================
param(
  [Parameter(Mandatory = $true)][string]$Action,      # probe | list | export | copy
  [string]$Path = "",                                  # ملف الأكسيس (att2000.mdb)
  [string]$From = "",                                  # yyyy-MM-dd (فلتر تاريخ للبصمات)
  [string]$To = "",
  [string]$Tables = "",                                # list مفصول بفواصل (اختياري)
  [string]$Out = "",                                   # ملف JSON للإخراج (export)
  [string]$CopyTo = "",                                # وجه النسخة الطابقة للأصل (copy)
  [int]$MaxRows = 0,                                   # حد صفوف اختياري للحماية
  [switch]$WithBinary                                  # يضمّن الصور/القوالب الحيوية base64
)

$ErrorActionPreference = 'Stop'
# stdout لازم يكون UTF-8 بلا BOM — server.js بيقرأه بايت-بايت والعربي لازم يوصل سليم
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }

# الأعمدة اللي فيها أسرار جهاز البصمة — ما تطلعش من التصدير نهائيًا
$SECRET_COLS = @('COMMPASSWORD', 'PASSWORD', 'PIN', 'FACEPIN', 'VERIFYCODE', 'CARDNO', 'BADGENO', 'BADGENUMBER')

function MizanEsc($v) {
  # تهريب JSON يدوي — أسرع بكتير من ConvertTo-Json على مئات آلاف الصفوف
  if ($null -eq $v) { return "" }
  $t = [string]$v
  $t = $t.Replace('\', '\\').Replace('"', '\"').Replace("`b", '\b').Replace("`f", '\f')
  $t = $t.Replace("`n", '\n').Replace("`r", '\r').Replace("`t", '\t')
  $sb = New-Object System.Text.StringBuilder          # باقي محارف التحكم (&lt; 0x20) → ‎\u00XX
  foreach ($ch in $t.ToCharArray()) {
    $c = [int]$ch
    if ($c -lt 32) { [void]$sb.Append('\u').Append($c.ToString('x4')) } else { [void]$sb.Append($ch) }
  }
  return $sb.ToString()
}

function Json-Str($v) {
  if ($null -eq $v) { return 'null' }
  return '"' + (MizanEsc $v) + '"'
}

function Emit-Error($msg) {
  [Console]::Out.WriteLine('{"ok":false,"error":' + (Json-Str $msg) + '}')
  exit 1
}

function Out-Line($s) { [Console]::Out.WriteLine($s) }

try {
  # ملاحظة: النفي في باور‌شيل لازم `-not` — علامة `-` وحدها طرح حسابي (True بتطلع -1 وبتتعتبر true)
  if ($Path -eq "" -or -not (Test-Path -LiteralPath $Path)) { Emit-Error "ملف البصمة مش موجود: $Path" }
  $item = Get-Item -LiteralPath $Path
  if ($item.PSIsContainer) { Emit-Error "المسار مجلد مش ملف: $Path" }

  # ---------- 1) probe: قراءة رأس الملف (Jet 3/4/ACE) + الحجم، من غير فتح اتصال ----------
  if ($Action -eq 'probe') {
    $fs = [System.IO.File]::Open($Path, 'Open', 'Read', 'ReadWrite')
    try {
      $b0 = $fs.ReadByte(); $b1 = $fs.ReadByte()
      $magic = ('{0:X2}{1:X2}' -f $b0, $b1)
    } finally { $fs.Close() }
    # 0001 = Jet 4.0 (.mdb) · 0002 = ACE 2007+ (.accdb) · 5373 = JET3
    $kind = switch ($magic) { '0001' { 'jet4' } '0002' { 'ace2007' } '5373' { 'jet3' } '0000' { 'encr-or-new' } default { 'unknown' } }
    Out-Line ('{"ok":true,"action":"probe","path":' + (Json-Str $Path) + ',"kind":' + (Json-Str $kind) +
      ',"magic":' + (Json-Str $magic) + ',"sizeBytes":' + [int64]$item.Length +
      ',"sizeMb":' + ([Math]::Round($item.Length / 1MB, 1)).ToString([Globalization.CultureInfo]::InvariantCulture) +
      ',"lastWrite":' + (Json-Str $item.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')) + '}')
    exit 0
  }

  # ---------- 4) copy: نسخة طبق الأصل من ملف الأكسيس — من غير أي اتصال ACE ----------
  # بتشتغل حتى لو مشغّل Access مش متسطّب، والمصدر بيفتح للقراءة فقط (Share ReadWrite)
  # فالنسخ مابيقفلش ملف العميل ولا بيغيّر فيه بايت واحد.
  if ($Action -eq 'copy') {
    if ($CopyTo -eq "") { Emit-Error "مفيش وجه للنسخة (CopyTo)" }
    $dir = Split-Path -Parent $CopyTo
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    if (Test-Path -LiteralPath $CopyTo) { Emit-Error "ملف النسخة موجود فعلًا — ما بندهمشش: $CopyTo" }
    $src = [System.IO.File]::Open($Path, 'Open', 'Read', 'ReadWrite')
    try {
      $dst = [System.IO.File]::Create($CopyTo)
      try { $src.CopyTo($dst) } finally { $dst.Close() }
    } finally { $src.Close() }
    $fi = Get-Item -LiteralPath $CopyTo
    $sameSize = ($fi.Length -eq $item.Length)
    Out-Line ('{"ok":' + $(if ($sameSize) { 'true' } else { 'false' }) + ',"action":"copy","file":' + (Json-Str $CopyTo) +
      ',"bytes":' + [int64]$fi.Length + ',"sourceBytes":' + [int64]$item.Length + ',"source":' + (Json-Str $Path) +
      ',"hash":' + (Json-Str (Get-FileHash -LiteralPath $CopyTo -Algorithm SHA256).Hash) +
      ',"error":' + (Json-Str $(if ($sameSize) { "" } else { "حجم النسخة ما طابقش المصدر" })) + '}')
    exit $(if ($sameSize) { 0 } else { 1 })
  }

  # list/export لوحدهم محتاجين مشغّل Access (المسار ده 32-بت لأن ACE.OLEDB.12 مسجّل فيه بس)
  $connStr = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$Path;Mode=Read"
  $conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
  $conn.Open()

  $script:colsByTable = @{}
  $script:colsLoaded = $false
  function Load-Columns {
    # كل الأعمدة مرة واحدة — GetSchema("Columns", restrictions) بيرمي OleDbException على Jet
    if ($script:colsLoaded) { return }
    $map = @{}
    foreach ($c in $conn.GetSchema('Columns')) {
      $tn = [string]$c['TABLE_NAME']
      if (-not $map.ContainsKey($tn)) { $map[$tn] = @() }
      $map[$tn] += [pscustomobject]@{ name = [string]$c['COLUMN_NAME']; type = [string]$c['TYPE_NAME'] }
    }
    $script:colsByTable = $map
    $script:colsLoaded = $true
  }

  # ---------- 2) list: الجداول + عدد الصفوف + آخر بصمة (لوحة معلومات البصمة) ----------
  if ($Action -eq 'list') {
    Load-Columns
    $names = @(); foreach ($r in $conn.GetSchema('Tables')) { if ($r['TABLE_TYPE'] -eq 'TABLE') { $names += [string]$r['TABLE_NAME'] } }
    $parts = @(); $total = 0
    foreach ($n in ($names | Sort-Object)) {
      $cnt = 0; $last = ""
      try { $c2 = $conn.CreateCommand(); $c2.CommandText = "SELECT COUNT(*) FROM [$n]"; $cnt = [int]$c2.ExecuteScalar() } catch { $cnt = -1 }
      $total += [int]$cnt
      if ($cnt -gt 0) {
        $hasCT = @($script:colsByTable[$n] | Where-Object { $_.name.ToUpper() -eq 'CHECKTIME' }).Count -gt 0
        if ($hasCT) {
          try {
            $c3 = $conn.CreateCommand(); $c3.CommandText = "SELECT MAX(CHECKTIME) FROM [$n]"
            $v = $c3.ExecuteScalar(); if ($v -ne [DBNull]::Value) { $last = ([DateTime]$v).ToString('yyyy-MM-dd HH:mm:ss') }
          } catch { $last = "" }
        }
      }
      $colNames = @($script:colsByTable[$n] | ForEach-Object { (Json-Str $_.name) })
      $parts += '{"name":' + (Json-Str $n) + ',"rows":' + $cnt + ',"lastPunch":' + (Json-Str $last) +
                ',"columns":[' + ($colNames -join ',') + ']}'
    }
    Out-Line ('{"ok":true,"action":"list","path":' + (Json-Str $Path) +
      ',"tableCount":' + $parts.Count + ',"rowCount":' + $total + ',"tables":[' + ($parts -join ',') + ']}')
    $conn.Close()
    exit 0
  }

  # ---------- 3) export: الجداول المطلوبة → JSON (بفلتر تاريخ على جدول البصمات) ----------
  if ($Action -eq 'export') {
    Load-Columns
    $want = @()
    if ($Tables -ne "") { $want = $Tables -split ',' } else {
      $want = @('Machines', 'DEPARTMENTS', 'SchClass', 'USERINFO', 'CHECKINOUT')
    }
    $have = @{}
    foreach ($r in $conn.GetSchema('Tables')) { if ($r['TABLE_TYPE'] -eq 'TABLE') { $have[[string]$r['TABLE_NAME'].ToUpper()] = $true } }

    $hasFilter = ($From -ne "" -or $To -ne "")
    # جدول البصمات ٤٥١ ألف صف ⇒ لازم فترة محددة، غير كده حجم مستحيل يتحمّل
    foreach ($t in $want) {
      if ($t.Trim().ToUpper() -eq 'CHECKINOUT' -and -not $hasFilter) {
        $conn.Close()
        Emit-Error "جدول البصمات كبير جدًا — حدّد الفترة (من/إلى) أو استبعده من قائمة الجداول"
      }
    }

    # الكتابة مباشرة لملف (StreamWriter) أو لـ stdout — من غير ما نجمّع المليون صف في متغيّر
    if ($Out -ne "") {
      $dir = Split-Path -Parent $Out
      if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
      $sw = New-Object System.IO.StreamWriter($Out, $false, (New-Object System.Text.UTF8Encoding($false)))
    } else {
      $sw = New-Object System.IO.StreamWriter([Console]::OpenStandardOutput(), (New-Object System.Text.UTF8Encoding($false)))
    }

    $counts = @{}
    $redacted = @()
    $sw.Write('{"ok":true,"action":"export","source":' + (Json-Str $Path) +
              ',"exportedAt":' + (Json-Str (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')) +
              ',"filters":{"from":' + (Json-Str $From) + ',"to":' + (Json-Str $To) + '},"tables":{')
    $firstT = $true
    foreach ($t in $want) {
      $tn = $t.Trim()
      if ($tn -eq "") { continue }
      if (-not $have.ContainsKey($tn.ToUpper())) { $counts[$tn] = -1; continue }
      $sql = "SELECT * FROM [$tn]"
      if ($tn.ToUpper() -eq 'CHECKINOUT' -and $hasFilter) {
        $w = @()
        if ($From -ne "") { $w += "CHECKTIME >= #$From#" }
        if ($To -ne "") { $w += "CHECKTIME <= #$To 23:59:59#" }
        $sql = "SELECT * FROM [$tn] WHERE " + ($w -join ' AND ')
      }
      $cmd = $conn.CreateCommand(); $cmd.CommandText = $sql
      $rd = $cmd.ExecuteReader()
      # الأعمدة المسموح بها (السرّية = محذوفة) بترتيبها الأصلي
      $keep = @()
      for ($oc = 0; $oc -lt $rd.FieldCount; $oc++) {
        $cn = $rd.GetName($oc)
        if ($SECRET_COLS -contains $cn.ToUpper()) { $redacted += $cn; continue }
        $keep += $oc
      }
      if (-not $firstT) { $sw.Write(',') }
      $firstT = $false
      $cn2 = @(); foreach ($oc in $keep) { $cn2 += (Json-Str $rd.GetName($oc)) }
      # المفتاح من Json-Str بيجي مقتبس بالفعل ⇒ النص التالى يبدأ بـ : مش بـ ":
      $sw.Write((Json-Str $tn) + ':{"columns":[' + ($cn2 -join ',') + '],"rows":[')
      $n = 0; $sep = ''
      while ($rd.Read()) {
        if ($MaxRows -gt 0 -and $n -ge $MaxRows) { break }
        $vals = @()
        foreach ($oc in $keep) {
          if ($rd.IsDBNull($oc)) { $vals += 'null'; continue }
          $v = $rd.GetValue($oc)
          if ($v -is [DateTime]) { $vals += (Json-Str $v.ToString('yyyy-MM-dd HH:mm:ss')) }
          elseif ($v -is [byte[]]) {
            if ($WithBinary) { $vals += (Json-Str ([System.Convert]::ToBase64String($v))) }
            else { $vals += '{"__bytes__":' + $v.Length + '}' }   # حجم بس — الصور والقوالب ما تنفخش الملف
          }
          elseif ($v -is [bool]) { $vals += $(if ($v) { 'true' } else { 'false' }) }
          elseif ($v -is [double] -or $v -is [single] -or $v -is [decimal]) {
            $vals += ([convert]::ToDecimal($v)).ToString([Globalization.CultureInfo]::InvariantCulture)
          }
          elseif ($v -is [int64] -or $v -is [int32] -or $v -is [uint32] -or $v -is [int16] -or $v -is [byte]) {
            $vals += [string]$v
          }
          else { $vals += (Json-Str $v) }
        }
        $sw.Write($sep + '[' + ($vals -join ',') + ']')
        $sep = ','
        $n++
      }
      $rd.Close(); $cmd.Dispose()
      $sw.Write(']}')
      $counts[$tn] = $n
    }
    $sw.Write('},"counts":{')
    $sepC = ''
    foreach ($k in $counts.Keys) { $sw.Write($sepC + (Json-Str $k) + ':' + $counts[$k]); $sepC = ',' }
    $sec = @(); foreach ($k in ($redacted | Sort-Object -Unique)) { $sec += (Json-Str $k) }
    $sw.Write('},"redactedColumns":[' + ($sec -join ',') + ']}')
    $sw.Close()
    $conn.Close()

    if ($Out -ne "") {
      $cJson = @(); foreach ($k in $counts.Keys) { $cJson += (Json-Str $k) + ':' + $counts[$k] }
      Out-Line ('{"ok":true,"action":"export","file":' + (Json-Str $Out) +
        ',"bytes":' + (Get-Item -LiteralPath $Out).Length + ',"counts":{' + ($cJson -join ',') +
        '},"redactedColumns":[' + (($redacted | Sort-Object -Unique | ForEach-Object { (Json-Str $_) }) -join ',') + ']}')
    }
    exit 0
  }

  $conn.Close()
  Emit-Error "فعل غير معروف: $Action"
}
catch {
  try { if ($conn) { $conn.Close() } } catch { }
  Emit-Error $_.Exception.Message
}
