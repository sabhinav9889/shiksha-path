#!/usr/bin/env bash
# The inside of restore-check.sh, run in the same image the nightly job uses.
set -euo pipefail
apt-get update -qq >/dev/null
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq age awscli postgresql-client-17 >/dev/null

fail() { echo "RESTORE CHECK FAILED: $*" >&2; exit 1; }
WORK="$(mktemp -d)"
age-keygen -o "$WORK/key.txt" 2>/dev/null
RECIPIENT="$(age-keygen -y "$WORK/key.txt")"

export BACKUP_DB_URL="$DB_URL" SUPABASE_URL="$API_URL" SUPABASE_S3_REGION="$S3_REGION" \
  SUPABASE_S3_ACCESS_KEY="$S3_KEY" SUPABASE_S3_SECRET_KEY="$S3_SECRET" \
  BACKUP_AGE_RECIPIENT="$RECIPIENT" BACKUP_R2_BUCKET="$CHECK_BUCKET" \
  R2_ENDPOINT="$API_URL/storage/v1/s3" R2_ACCESS_KEY_ID="$S3_KEY" R2_SECRET_ACCESS_KEY="$S3_SECRET"

echo "a missing secret must fail the job"
if (unset R2_SECRET_ACCESS_KEY; bash /repo/tooling/backup/backup.sh) >"$WORK/missing.log" 2>&1; then
  fail "backup.sh succeeded without R2_SECRET_ACCESS_KEY"
fi
grep -q "missing settings: R2_SECRET_ACCESS_KEY" "$WORK/missing.log" || fail "no clear message"

echo "running the backup"
bash /repo/tooling/backup/backup.sh >"$WORK/run.log" 2>&1 || { cat "$WORK/run.log"; fail "backup"; }
for secret in "$S3_SECRET" "$DB_URL"; do
  grep -qF "$secret" "$WORK/run.log" && fail "a secret appeared in the output"
done

echo "checking what reached the backup bucket"
s3() {
  AWS_ACCESS_KEY_ID="$S3_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET" \
    aws "$@" --endpoint-url "$API_URL/storage/v1/s3" --region "$S3_REGION" --only-show-errors
}
mkdir -p "$WORK/got"
s3 s3 cp "s3://$CHECK_BUCKET/" "$WORK/got/" --recursive
DB_FILE="$(ls "$WORK"/got/db-*.dump.age)"
REC_FILE="$(ls "$WORK"/got/recordings-*.tar.age)"
for file in "$DB_FILE" "$REC_FILE"; do
  head -c 21 "$file" | grep -q "age-encryption.org/v1" || fail "$(basename "$file") is not encrypted"
done

echo "restoring into a fresh database"
ADMIN_URL="${DB_URL%/*}/postgres"
psql "$ADMIN_URL" -qtAX -c "drop database if exists restore_check" -c "create database restore_check"
age -d -i "$WORK/key.txt" "$DB_FILE" > "$WORK/db.dump"
pg_restore --no-owner --no-privileges -d "${DB_URL%/*}/restore_check" "$WORK/db.dump" \
  2>"$WORK/restore.log" || true # Supabase-owned objects may warn; the counts below decide
count() {
  psql "$1" -qtAX -c "select (select count(*) from public.learners where id in ('$L1','$L2'))
    || '/' || (select count(*) from public.learner_events where learner_id in ('$L1','$L2'))
    || '/' || (select count(*) from public.recordings where id = '$REC')"
}
[[ "$(count "$DB_URL")" == "2/2/1" ]] || fail "the seed is not in the source"
[[ "$(count "${DB_URL%/*}/restore_check")" == "2/2/1" ]] || { cat "$WORK/restore.log"; fail "restore"; }

echo "checking the recording's bytes"
age -d -i "$WORK/key.txt" "$REC_FILE" | tar -C "$WORK" -xf -
[[ "$(od -An -tx1 "$WORK/recordings/$L1/$REC" | tr -d ' \n')" == "01020304" ]] || fail "bytes differ"
echo "all checks passed"
