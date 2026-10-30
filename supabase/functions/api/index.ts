// The /v1 API on Supabase Edge Functions: build the dependencies once, then hand every request
// to the plain-TypeScript handler. No logic lives here (spec §5.5).
import {
  createSql,
  createSupabaseAuth,
  handle,
  jsonLogger,
  PgEventRepo,
  PgAttendanceRepo,
  PgAuditRepo,
  PgBrandingRepo,
  PgCodeRepo,
  PgLearnerDataRepo,
  PgLearnerRepo,
  PgBookingRepo,
  PgOrgRepo,
  PgPostRepo,
  PgStaffRepo,
  PgSummaryRepo,
  PgRateLimiter,
  PgRecordingRepo,
  createSupabaseRecordingStorage,
  PgSwitchRepo,
} from './server.bundle.js';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing environment setting ${name}`);
  return value;
}

const MIN_PEPPER = 32;
const pepper = env('CODE_PEPPER');
if (pepper.length < MIN_PEPPER) throw new Error('CODE_PEPPER must be at least 32 characters');

const sql = createSql(env('SUPABASE_DB_URL'));
const deps = {
  auth: createSupabaseAuth(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY')),
  learners: new PgLearnerRepo(sql),
  audit: new PgAuditRepo(sql),
  attendance: new PgAttendanceRepo(sql),
  posts: new PgPostRepo(sql),
  bookings: new PgBookingRepo(sql),
  summaries: new PgSummaryRepo(sql),
  staff: new PgStaffRepo(sql),
  org: new PgOrgRepo(sql),
  data: new PgLearnerDataRepo(sql),
  branding: new PgBrandingRepo(sql),
  events: new PgEventRepo(sql),
  switches: new PgSwitchRepo(sql),
  limiter: new PgRateLimiter(sql),
  codes: new PgCodeRepo(sql),
  pepper,
  recordings: new PgRecordingRepo(sql),
  storage: createSupabaseRecordingStorage(
    env('SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY'),
    Deno.env.get('PUBLIC_SUPABASE_URL') ?? env('SUPABASE_URL'), // set only on a local stack
  ),
  allowedOrigins: env('ALLOWED_ORIGINS')
    .split(',')
    .map((origin: string) => origin.trim()),
  // The only place the API writes logs: one JSON line per request, ids and codes only.
  logger: jsonLogger((line: string) => console.log(line)),
};

Deno.serve((request: Request) => handle(request, deps));
