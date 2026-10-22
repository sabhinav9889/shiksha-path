#!/usr/bin/env bash
# NGO-owned backups (spec §5.5 rule 7, Plan 3b): the database and the recordings, encrypted with
# age to the NGO's public key, uploaded to the NGO's own S3-compatible bucket (Cloudflare R2).
# Runs in debian:trixie (age, awscli, postgresql-client-17). Never prints a secret.
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: tooling/backup/backup.sh [--help] [--dry-run]

Needs these environment variables (their values are never printed):
  BACKUP_DB_URL            Postgres connection string of the project
  SUPABASE_URL             https://<project>.supabase.co (its S3 endpoint is /storage/v1/s3)
  SUPABASE_S3_REGION       the project's region, e.g. ap-south-1
  SUPABASE_S3_ACCESS_KEY   Storage S3 access key
  SUPABASE_S3_SECRET_KEY   Storage S3 secret key
  BACKUP_AGE_RECIPIENT     the NGO's age public key (age1...)
  BACKUP_R2_BUCKET         the NGO's bucket name
  R2_ENDPOINT              https://<account>.r2.cloudflarestorage.com
  R2_ACCESS_KEY_ID         R2 access key
  R2_SECRET_ACCESS_KEY     R2 secret key

--dry-run checks the variables and prints the steps without running them.
USAGE
}

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --help) usage; exit 0 ;;
    --dry-run) DRY_RUN=1 ;;
    *) echo "unknown option: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

REQUIRED=(BACKUP_DB_URL SUPABASE_URL SUPABASE_S3_REGION SUPABASE_S3_ACCESS_KEY
  SUPABASE_S3_SECRET_KEY BACKUP_AGE_RECIPIENT BACKUP_R2_BUCKET R2_ENDPOINT R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY)
missing=()
for name in "${REQUIRED[@]}"; do
  [[ -n "${!name:-}" ]] || missing+=("$name")
done
if ((${#missing[@]} > 0)); then
  echo "missing settings: ${missing[*]}" >&2
  exit 1
fi

STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
DB_FILE="db-${STAMP}.dump.age"
REC_FILE="recordings-${STAMP}.tar.age"

if ((DRY_RUN)); then
  echo "would dump the public and auth schemas, encrypted, to ${DB_FILE}"
  echo "would copy the recordings bucket, encrypted, to ${REC_FILE}"
  echo "would upload both to the backup bucket"
  exit 0
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "dumping the database"
pg_dump --format=custom --no-owner --no-privileges --schema=public --schema=auth \
  "$BACKUP_DB_URL" | age -r "$BACKUP_AGE_RECIPIENT" > "$WORK/$DB_FILE"

echo "copying the recordings"
mkdir -p "$WORK/recordings"
AWS_ACCESS_KEY_ID="$SUPABASE_S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$SUPABASE_S3_SECRET_KEY" \
  aws s3 sync "s3://recordings" "$WORK/recordings" --only-show-errors \
  --endpoint-url "${SUPABASE_URL%/}/storage/v1/s3" --region "$SUPABASE_S3_REGION"
tar -C "$WORK" -cf - recordings | age -r "$BACKUP_AGE_RECIPIENT" > "$WORK/$REC_FILE"

echo "uploading"
for file in "$DB_FILE" "$REC_FILE"; do
  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    aws s3 cp "$WORK/$file" "s3://${BACKUP_R2_BUCKET}/${file}" --only-show-errors \
    --endpoint-url "$R2_ENDPOINT" --region auto
done
echo "backup done: ${DB_FILE}, ${REC_FILE}"
