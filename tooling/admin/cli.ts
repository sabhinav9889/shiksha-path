// `npm run admin -- <command>`: see USAGE in commands.ts.
import { makeAdminDeps, runAdmin, USAGE } from './commands.js';

const argv = process.argv.slice(2);
const io = {
  out: (line: string) => process.stdout.write(`${line}\n`),
  err: (line: string) => process.stderr.write(`${line}\n`),
};

if (argv.length === 0 || argv.includes('--help')) {
  io.out(USAGE); // help needs no keys
  process.exit(argv.length === 0 ? 1 : 0);
}

const deps = makeAdminDeps(process.env);
try {
  process.exitCode = await runAdmin(argv, deps, io);
} finally {
  await deps.close();
}
