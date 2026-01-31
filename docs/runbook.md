# Runbook (Import Operations)

## Import Execution (dry-run → run)
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
- **batch_id 기준 삭제**: import 시 생성/기록되는 batch_id가 있다면 해당 batch_id로 삭제.
- **imported_at 기준 삭제**: 특정 시각 이후에 들어간 데이터만 삭제.

예시 SQL (배치 ID 방식):
```sql
DELETE FROM questions WHERE batch_id = 'YOUR_BATCH_ID';
```

예시 SQL (시간 기준 방식):
```sql
DELETE FROM questions WHERE imported_at >= '2026-01-31T00:00:00Z';
```

## Minimal Check SQL
1) 총 건수:
```sql
SELECT COUNT(*) AS total FROM questions;
```

2) is_active 분포:
```sql
SELECT is_active, COUNT(*) AS count
FROM questions
GROUP BY is_active
ORDER BY is_active;
```

3) 최근 삽입 N건:
```sql
SELECT public_qid, created_at
FROM questions
ORDER BY created_at DESC
LIMIT 20;
```

## Do NOTs (Strict)
- **서비스 롤 키 노출 금지**: SUPABASE_SERVICE_ROLE_KEY는 절대 클라이언트/로그/공유에 노출하지 말 것.
- **NEXT_PUBLIC로 서비스 롤 키 등록 금지**: `NEXT_PUBLIC_` 접두사는 공개 번들이므로 사용 금지.
- **운영 DB 직접 수정 남발 금지**: 스크립트/절차 없이 수작업 변경 금지.
