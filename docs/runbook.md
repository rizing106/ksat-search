# Runbook (Import Operations)
## ¿î¿µ Import ÀıÂ÷(ÇÊ¼ö ¼ø¼­)
1) csv:seed  
   - ½ÇÆĞ ½Ã: Supabase ¿¬°á/±ÇÇÑ°ú .env.local Å°(SUPABASE_SERVICE_ROLE_KEY) È®ÀÎ ÈÄ Àç½Ãµµ.
2) csv:validate  
   - ½ÇÆĞ ½Ã: ·Î±×ÀÇ ¿À·ù ÇàÀ» ¼öÁ¤ÇÏ°í µ¿ÀÏ Á¶°ÇÀ¸·Î Àç°ËÁõ.
3) import_run.ps1 -DryRun  
   - ½ÇÆĞ ½Ã: validate °á°ú/CSV Æ÷¸ËÀ» ´Ù½Ã È®ÀÎÇÏ°í DryRun ·Î±×·Î ¿øÀÎ ÃßÀû.
4) import_run.ps1 (½ÇÁ¦)  
   - ½ÇÆĞ ½Ã: `logs/import/*.log` ¹× `*.manifest.json` È®ÀÎ ÈÄ ·Ñ¹é ±âÁØ¿¡ µû¶ó Á¶Ä¡.

## Import Execution (dry-run ??run)
1) Dry-run (validate only, no DB writes)
```powershell
npx tsx scripts/import_questions.ts --file .\data\questions.sample.csv --limit 50 --dry-run
```
2) Real run (write to DB)
```powershell
npx tsx scripts/import_questions.ts --file .\data\questions.sample.csv --limit 50
```

## Rollback Criteria (Failure Handling)
Use one of the following rollback strategies:
- **batch_id ê¸°ì? ?? œ**: import ???ì„±/ê¸°ë¡?˜ëŠ” batch_idê°€ ?ˆë‹¤ë©??´ë‹¹ batch_idë¡??? œ.
- **imported_at ê¸°ì? ?? œ**: ?¹ì • ?œê° ?´í›„???¤ì–´ê°??°ì´?°ë§Œ ?? œ.

?ˆì‹œ SQL (ë°°ì¹˜ ID ë°©ì‹):
```sql
DELETE FROM questions WHERE batch_id = 'YOUR_BATCH_ID';
```

?ˆì‹œ SQL (?œê°„ ê¸°ì? ë°©ì‹):
```sql
DELETE FROM questions WHERE imported_at >= '2026-01-31T00:00:00Z';
```

## Minimal Check SQL
1) ì´?ê±´ìˆ˜:
```sql
SELECT COUNT(*) AS total FROM questions;
```

2) is_active ë¶„í¬:
```sql
SELECT is_active, COUNT(*) AS count
FROM questions
GROUP BY is_active
ORDER BY is_active;
```

3) ìµœê·¼ ?½ì… Nê±?
```sql
SELECT public_qid, created_at
FROM questions
ORDER BY created_at DESC
LIMIT 20;
```

## Rate limit ê²€ì¦??´ì˜)
PowerShell ?™ì‹œ ?ŒìŠ¤??120 jobs) ?ˆì‹œ:
```powershell
$url = "https://ksat-search.vercel.app/api/questions?page=1&pageSize=5&q=%EC%88%98%ED%95%99"
$jobs = 1..120 | ForEach-Object { Start-Job -ScriptBlock { param($u) Invoke-WebRequest -Uri $u -UseBasicParsing | Select-Object -ExpandProperty StatusCode } -ArgumentList $url }
$results = $jobs | Wait-Job | Receive-Job
$results | Group-Object | Sort-Object Name | ForEach-Object { "{0}: {1}" -f $_.Name, $_.Count }
```
ê¸°ë? ê²°ê³¼: 200ê³?429ê°€ ?ì„ (429ê°€ ?˜ì˜¤ë©??•ìƒ).
ì£¼ì˜: URL?€ ?™ì¼?˜ê²Œ ? ì??´ì•¼ ??ì¿¼ë¦¬ ë°”ê¾¸ë©??Œí”¼?????ˆìŒ).

## Do NOTs (Strict)
- **?œë¹„??ë¡????¸ì¶œ ê¸ˆì?**: SUPABASE_SERVICE_ROLE_KEY???ˆë? ?´ë¼?´ì–¸??ë¡œê·¸/ê³µìœ ???¸ì¶œ?˜ì? ë§?ê²?
- **NEXT_PUBLICë¡??œë¹„??ë¡????±ë¡ ê¸ˆì?**: `NEXT_PUBLIC_` ?‘ë‘?¬ëŠ” ê³µê°œ ë²ˆë“¤?´ë?ë¡??¬ìš© ê¸ˆì?.
- **?´ì˜ DB ì§ì ‘ ?˜ì • ?¨ë°œ ê¸ˆì?**: ?¤í¬ë¦½íŠ¸/?ˆì°¨ ?†ì´ ?˜ì‘??ë³€ê²?ê¸ˆì?.

