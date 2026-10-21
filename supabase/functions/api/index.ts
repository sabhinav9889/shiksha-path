// The /v1 API on Supabase Edge Functions: build the dependencies once, then hand every request
// to the plain-TypeScript handler. No logic lives here (spec §5.5).
import {
  createSql,
  createSupabaseAuth,
  handle,
  PgEventRepo,
  PgLearnerRepo,
  PgSwitchRepo,
} from './server.bundle.js';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing environment setting ${name}`);
  return value;
}

const sql = createSql(env('SUPABASE_DB_URL'));
const deps = {
  auth: createSupabaseAuth(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY')),
  learners: new PgLearnerRepo(sql),
  events: new PgEventRepo(sql),
  switches: new PgSwitchRepo(sql),
  allowedOrigins: env('ALLOWED_ORIGINS')
    .split(',')
    .map((origin: string) => origin.trim()),
};

Deno.serve((request: Request) => handle(request, deps));
