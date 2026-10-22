// The owner's admin tool until the admin panel (Plan 4): issue and reset backup codes, export and
// delete a student's data. It runs the same services the API uses, with keys from the environment.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brandingInput } from '@shiksha/api-contract';
import { z } from 'zod';
import { PgAuditRepo } from '../../packages/server/src/adapters/pg-audit-repo.js';
import { PgBrandingRepo } from '../../packages/server/src/adapters/pg-branding-repo.js';
import { PgCodeRepo } from '../../packages/server/src/adapters/pg-code-repo.js';
import { PgOrgRepo } from '../../packages/server/src/adapters/pg-org-repo.js';
import { PgStaffRepo } from '../../packages/server/src/adapters/pg-staff-repo.js';
import { PgLearnerDataRepo } from '../../packages/server/src/adapters/pg-learner-data-repo.js';
import { PgLearnerRepo } from '../../packages/server/src/adapters/pg-learner-repo.js';
import { PgRateLimiter } from '../../packages/server/src/adapters/pg-rate-limiter.js';
import { PgRecordingRepo } from '../../packages/server/src/adapters/pg-recording-repo.js';
import { PgSwitchRepo } from '../../packages/server/src/adapters/pg-switch-repo.js';
import { createSql } from '../../packages/server/src/adapters/pg.js';
import { createSupabaseAuth } from '../../packages/server/src/adapters/supabase-auth.js';
import { createSupabaseRecordingStorage } from '../../packages/server/src/adapters/supabase-recording-storage.js';
import { setBranding } from '../../packages/server/src/services/branding.js';
import { issueCode, resetCode, type CodeDeps } from '../../packages/server/src/services/codes.js';
import type {
  BrandingRepo,
  OrgRepo,
  StaffRepo,
  StaffRole,
} from '../../packages/server/src/ports.js';
import { ApiFailure } from '../../packages/server/src/services/failure.js';
import {
  deleteLearner,
  exportLearner,
  type LearnerDataDeps,
} from '../../packages/server/src/services/learner-data.js';
import { runRetention, type RetentionDeps } from '../../packages/server/src/services/retention.js';

export interface AdminIo {
  out(line: string): void;
  err(line: string): void;
}

export interface AdminDeps {
  codes: CodeDeps;
  data: LearnerDataDeps;
  retention: RetentionDeps;
  branding: BrandingRepo;
  staff: StaffRepo;
  org: OrgRepo;
  close(): Promise<void>;
}

const MIN_PEPPER = 32;
const adminEnv = z.object({
  SUPABASE_DB_URL: z.string().min(1, 'SUPABASE_DB_URL is missing'),
  SUPABASE_URL: z.string().min(1, 'SUPABASE_URL is missing'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is missing'),
  CODE_PEPPER: z.string().min(MIN_PEPPER, 'CODE_PEPPER must be at least 32 characters'),
});

/** The services over the real database and Supabase, from the environment (never printed). */
export function makeAdminDeps(env: Record<string, string | undefined>): AdminDeps {
  const parsed = adminEnv.safeParse(env);
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  const e = parsed.data;
  const sql = createSql(e.SUPABASE_DB_URL);
  const auth = createSupabaseAuth(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY);
  const recordings = new PgRecordingRepo(sql);
  const storage = createSupabaseRecordingStorage(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY);
  return {
    codes: {
      learners: new PgLearnerRepo(sql),
      switches: new PgSwitchRepo(sql),
      codes: new PgCodeRepo(sql),
      auth,
      limiter: new PgRateLimiter(sql),
      pepper: e.CODE_PEPPER,
    },
    data: {
      audit: new PgAuditRepo(sql),
      data: new PgLearnerDataRepo(sql),
      recordings,
      storage,
      auth,
    },
    retention: {
      data: new PgLearnerDataRepo(sql),
      recordings,
      storage,
      limiter: new PgRateLimiter(sql),
    },
    branding: new PgBrandingRepo(sql),
    staff: new PgStaffRepo(sql),
    org: new PgOrgRepo(sql),
    close: () => sql.end(),
  };
}

export const USAGE = `Usage: npm run admin -- <command> [options]

  issue-code --name <name> [--cohort <id>] | --learner <id>   A code for a student without Google
  reset-code --learner <id>                   A new code; the old one stops working at once
  export --learner <id> --out <folder>        learner.json and the recordings, into the folder
  delete --learner <id> --yes                 Delete everything about the student, everywhere
  retention                                   Delete recordings past their time (runs nightly)
  set-branding --file <json>                  Name {hi, en}, primary and accent colours (#rrggbb)
  add-staff --email <e> --role admin|mentor --name <n>   Invite staff (the first admin starts here)

Every command takes --dry-run (say what would happen) and --help.
Reads SUPABASE_DB_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and CODE_PEPPER from the
environment. It never prints them, or a student's name or email.`;

interface Args {
  command: string | undefined;
  options: Map<string, string | true>;
}

function parse(argv: string[]): Args {
  const options = new Map<string, string | true>();
  let command: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (!arg.startsWith('--')) {
      command ??= arg;
      continue;
    }
    const next = argv[i + 1];
    const takesValue = next !== undefined && !next.startsWith('--');
    options.set(arg.slice(2), takesValue ? next : true);
    if (takesValue) i += 1;
  }
  return { command, options };
}

const text = (args: Args, name: string): string | null => {
  const value = args.options.get(name);
  return typeof value === 'string' ? value : null;
};

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

type Command = (args: Args, deps: AdminDeps, io: AdminIo) => Promise<number>;

const issue: Command = async (args, deps, io) => {
  const learnerId = text(args, 'learner');
  const name = text(args, 'name');
  if (!learnerId && !name) return usage(io, 'issue-code needs --name or --learner');
  if (args.options.has('dry-run')) {
    io.out(`would issue a code for ${learnerId ? `learner ${learnerId}` : 'a new student'}`);
    return 0;
  }
  const out = await issueCode(deps.codes, learnerId ? { learnerId } : { name: name ?? '' });
  const cohortId = text(args, 'cohort');
  if (cohortId) await deps.org.setLearnerCohort(out.learnerId, cohortId);
  io.out(`learner ${out.learnerId}`);
  io.out(`code ${out.code}`);
  return 0;
};

const reset: Command = async (args, deps, io) => {
  const learnerId = text(args, 'learner');
  if (!learnerId) return usage(io, 'reset-code needs --learner');
  if (args.options.has('dry-run')) {
    io.out(`would reset the code of learner ${learnerId}`);
    return 0;
  }
  io.out(`code ${(await resetCode(deps.codes, learnerId)).code}`);
  return 0;
};

const EXTENSION: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
};

const exportCommand: Command = async (args, deps, io) => {
  const learnerId = text(args, 'learner');
  const folder = text(args, 'out');
  if (!learnerId || !folder) return usage(io, 'export needs --learner and --out');
  const { data, recordings } = await exportLearner(deps.data, learnerId);
  if (args.options.has('dry-run')) {
    io.out(`would write learner.json and ${plural(recordings.length, 'recording')}`);
    return 0;
  }
  mkdirSync(join(folder, 'recordings'), { recursive: true });
  writeFileSync(join(folder, 'learner.json'), `${JSON.stringify(data, null, 2)}\n`);
  for (const r of recordings) {
    writeFileSync(join(folder, 'recordings', `${r.id}.${EXTENSION[r.mime] ?? 'bin'}`), r.bytes);
  }
  io.out(`wrote learner.json and ${plural(recordings.length, 'recording')}`);
  return 0;
};

const remove: Command = async (args, deps, io) => {
  const learnerId = text(args, 'learner');
  if (!learnerId) return usage(io, 'delete needs --learner');
  if (args.options.has('dry-run')) {
    const rows = await deps.data.data.rows(learnerId);
    const recordings = await deps.data.recordings.listByLearner(learnerId);
    if (!rows) return usage(io, 'no such learner');
    io.out(
      `would delete: ${plural(rows.events.length, 'event')}, ` +
        `${plural(recordings.length, 'recording')}, ${plural(rows.authUserIds.length, 'sign-in')}`,
    );
    return 0;
  }
  if (!args.options.has('yes')) return usage(io, 'delete needs --yes (it cannot be undone)');
  const done = await deleteLearner(deps.data, learnerId);
  io.out(
    `deleted: ${plural(done.events, 'event')}, ${plural(done.recordings, 'recording')}, ` +
      `${plural(done.authUsers, 'sign-in')}`,
  );
  return 0;
};

const retention: Command = async (args, deps, io) => {
  const now = new Date();
  if (args.options.has('dry-run')) {
    const due = await deps.retention.recordings.due(now);
    io.out(`would delete ${plural(due.length, 'recording')}`);
    return 0;
  }
  const done = await runRetention(deps.retention, now);
  io.out(
    `deleted ${plural(done.recordings, 'recording')}, ` +
      `${plural(done.rateWindows, 'rate-limit window')}`,
  );
  return 0;
};

const brand: Command = async (args, deps, io) => {
  const file = text(args, 'file');
  if (!file) return usage(io, 'set-branding needs --file');
  const input: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const checked = brandingInput.safeParse(input);
  if (!checked.success) return usage(io, 'refused: a name or colour is not allowed (contrast 4.5)');
  if (args.options.has('dry-run')) {
    io.out('would set the branding');
    return 0;
  }
  io.out(
    `branding version ${(await setBranding({ branding: deps.branding }, checked.data)).version}`,
  );
  return 0;
};

const ROLES = new Set(['admin', 'mentor']);

const addStaff: Command = async (args, deps, io) => {
  const email = text(args, 'email');
  const role = text(args, 'role');
  const name = text(args, 'name');
  if (!email || !name || !role || !ROLES.has(role)) {
    return usage(io, 'add-staff needs --email, --name and --role admin|mentor');
  }
  if (await deps.staff.byEmail(email)) return usage(io, 'refused: that email is already invited');
  if (args.options.has('dry-run')) {
    io.out(`would invite a ${role}`);
    return 0;
  }
  const id = await deps.staff.save({
    email,
    name,
    role: role as StaffRole,
    active: true,
    cohortIds: [],
  });
  io.out(`staff ${id}`);
  return 0;
};

function usage(io: AdminIo, problem: string): number {
  io.err(problem);
  io.err('run with --help for the commands');
  return 1;
}

const COMMANDS: Record<string, Command> = {
  'issue-code': issue,
  'reset-code': reset,
  export: exportCommand,
  delete: remove,
  retention,
  'set-branding': brand,
  'add-staff': addStaff,
};

/** Run one command; returns the exit code. Refusals from the services exit 1 with a reason. */
export async function runAdmin(argv: string[], deps: AdminDeps, io: AdminIo): Promise<number> {
  const args = parse(argv);
  if (args.options.has('help') || !args.command) {
    io.out(USAGE);
    return args.command || args.options.has('help') ? 0 : 1;
  }
  const command = COMMANDS[args.command];
  if (!command) return usage(io, `unknown command: ${args.command}`);
  try {
    return await command(args, deps, io);
  } catch (error) {
    if (error instanceof ApiFailure) return usage(io, `refused (${error.code})`);
    throw error;
  }
}
