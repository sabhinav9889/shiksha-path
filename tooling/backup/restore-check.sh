#!/usr/bin/env bash
# Proves the backup works end to end on the local stack (Plan 3b, Task 11): seed two learners and
# a recording, run backup.sh into a throwaway bucket standing in for R2 (the local stack's own S3
# endpoint), check what was uploaded is age-encrypted, restore it into a fresh database and compare.
# Also: a missing secret fails the job, and no secret value appears in its output.
set -euo pipefail

if [[ "${1:-}" == "--help" ]]; then
  echo "Usage: tooling/backup/restore-check.sh   (needs Docker and npm run db:start)"
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE="debian:trixie@sha256:4c25275446ca371766b8b093c696782eabce06263fccacb8d5d813b3dc44b308"
DB_CONTAINER="supabase_db_shiksha-path"

STATUS="$(cd "$ROOT" && npx supabase status -o env 2>/dev/null)"
value() { grep -E "^$1=" <<<"$STATUS" | head -1 | cut -d= -f2- | tr -d '"'; }
API_URL="$(value API_URL)"
SERVICE_KEY="$(value SERVICE_ROLE_KEY)"

L1="$(cat /proc/sys/kernel/random/uuid)"
L2="$(cat /proc/sys/kernel/random/uuid)"
REC="$(cat /proc/sys/kernel/random/uuid)"
CHECK_BUCKET="backup-check-$(date +%s)"

sql() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -qtAX -v ON_ERROR_STOP=1 -c "$1"; }
storage() {
  curl -fsS -H "Authorization: Bearer $SERVICE_KEY" -H "apikey: $SERVICE_KEY" "$@" >/dev/null
}

cleanup() {
  sql "delete from public.learners where id in ('$L1', '$L2'); drop database if exists restore_check;" \
    >/dev/null 2>&1 || true
  storage -X DELETE "$API_URL/storage/v1/object/recordings" -H 'content-type: application/json' \
    -d "{\"prefixes\": [\"$L1/$REC\"]}" 2>/dev/null || true
  storage -X POST "$API_URL/storage/v1/bucket/$CHECK_BUCKET/empty" 2>/dev/null || true
  storage -X DELETE "$API_URL/storage/v1/bucket/$CHECK_BUCKET" 2>/dev/null || true
}
trap cleanup EXIT

echo "seeding two learners, their events and a recording"
sql "insert into public.learners (id, name) values ('$L1', 'one'), ('$L2', 'two');
     insert into public.learner_events (id, learner_id, type, at, data)
       select gen_random_uuid(), l, 'language_changed', now(), '{\"preference\":\"hi_en\"}'
       from unnest(array['$L1', '$L2']::uuid[]) l;
     insert into public.recordings (id, learner_id, lesson_id, item_id, mime, bytes, duration_ms,
       recorded_at, status) values ('$REC', '$L1', 'ef1-02', 's1', 'audio/webm', 4, 1000, now(),
       'uploaded');"
printf '\x01\x02\x03\x04' | storage -X POST "$API_URL/storage/v1/object/recordings/$L1/$REC" \
  -H 'content-type: audio/webm' --data-binary @-
storage -X POST "$API_URL/storage/v1/bucket" -H 'content-type: application/json' \
  -d "{\"id\": \"$CHECK_BUCKET\", \"name\": \"$CHECK_BUCKET\", \"public\": false}"

docker run --rm --network host -v "$ROOT:/repo:ro" \
  -e DB_URL="$(value DB_URL)" -e API_URL="$API_URL" \
  -e S3_KEY="$(value S3_PROTOCOL_ACCESS_KEY_ID)" -e S3_SECRET="$(value S3_PROTOCOL_ACCESS_KEY_SECRET)" \
  -e S3_REGION="$(value S3_PROTOCOL_REGION)" -e CHECK_BUCKET="$CHECK_BUCKET" \
  -e L1="$L1" -e L2="$L2" -e REC="$REC" \
  "$IMAGE" bash /repo/tooling/backup/restore-verify.sh
echo "RESTORE CHECK OK"
