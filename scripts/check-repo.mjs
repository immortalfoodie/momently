import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

const MB = 1024 * 1024;
const KB = 1024;
const MAX_TOTAL_BYTES = 5 * MB;
const WARN_TOTAL_BYTES = 3 * MB;
const MAX_SINGLE_FILE_BYTES = 500 * KB;

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function splitLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function checkBranches(localBranches, remoteBranches, hasRemote) {
  const errors = [];
  if (localBranches.length !== 1 || localBranches[0] !== 'main') {
    errors.push(`Expected local branches to be [main], found: [${localBranches.join(', ')}]`);
  }
  if (hasRemote) {
    const filteredRemotes = remoteBranches.filter((b) => b !== 'origin' && b !== 'origin/HEAD');
    const invalidRemotes = filteredRemotes.filter((b) => b !== 'origin/main');
    if (invalidRemotes.length > 0) {
      errors.push(`Unexpected remote branches: [${invalidRemotes.join(', ')}]`);
    }
  }
  return errors;
}

function checkTrackedPaths(files) {
  const errors = [];
  for (const file of files) {
    const name = basename(file);
    if (name.startsWith('.env') && name !== '.env.example') {
      errors.push(`Forbidden tracked env file: ${file}`);
    }
    if (/^(node_modules|\.next|coverage)(\/|$)/.test(file)) {
      errors.push(`Forbidden tracked build/dependency path: ${file}`);
    }
  }
  return errors;
}

function evaluateFileSizes(fileStats) {
  const errors = [];
  const warnings = [];
  let totalBytes = 0;

  for (const entry of fileStats) {
    totalBytes += entry.size;
    if (entry.size > MAX_SINGLE_FILE_BYTES && entry.path !== 'package-lock.json') {
      errors.push(
        `Tracked file exceeds 500 KB: ${entry.path} (${(entry.size / KB).toFixed(1)} KB)`,
      );
    }
  }

  if (totalBytes >= MAX_TOTAL_BYTES) {
    errors.push(
      `Total tracked size ${(totalBytes / MB).toFixed(2)} MB exceeds 5 MB limit`,
    );
  } else if (totalBytes > WARN_TOTAL_BYTES) {
    warnings.push(
      `Total tracked size ${(totalBytes / MB).toFixed(2)} MB exceeds 3 MB warning threshold`,
    );
  }

  const largestFive = [...fileStats]
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);

  return { totalBytes, largestFive, errors, warnings };
}

function checkEnvExampleContent(content) {
  const errors = [];
  const keyMatch = content.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
  if (keyMatch && keyMatch[1]) {
    const value = keyMatch[1].trim();
    if (/^(AIza[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{20,})$/.test(value)) {
      errors.push('.env.example appears to contain a real-looking GEMINI_API_KEY value');
    }
  }
  return errors;
}

function formatKb(bytes) {
  return `${(bytes / KB).toFixed(1)} KB`;
}

function collectRepoState() {
  const localBranches = splitLines(
    runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads']),
  );
  const remotes = splitLines(runGit(['remote']));
  const remoteBranches =
    remotes.length > 0
      ? splitLines(runGit(['for-each-ref', '--format=%(refname:short)', 'refs/remotes']))
      : [];
  const trackedFiles = splitLines(runGit(['ls-files']));
  const fileStats = trackedFiles.map((filePath) => ({
    path: filePath,
    size: existsSync(filePath) ? statSync(filePath).size : 0,
  }));
  const statusPorcelain = runGit(['status', '--porcelain']);
  const envExample = existsSync('.env.example') ? readFileSync('.env.example', 'utf8') : '';

  return {
    localBranches,
    remoteBranches,
    hasRemote: remotes.length > 0,
    trackedFiles,
    fileStats,
    statusPorcelain,
    envExample,
  };
}

function main() {
  const state = collectRepoState();
  const branchErrors = checkBranches(state.localBranches, state.remoteBranches, state.hasRemote);
  const pathErrors = checkTrackedPaths(state.trackedFiles);
  const sizeReport = evaluateFileSizes(state.fileStats);
  const envErrors = checkEnvExampleContent(state.envExample);

  const errors = [...branchErrors, ...pathErrors, ...sizeReport.errors, ...envErrors];
  const warnings = [...sizeReport.warnings];
  if (state.statusPorcelain.length > 0) {
    warnings.push('Working tree has uncommitted changes');
  }

  const lines = [
    '=== Momently Repository Hygiene Report ===',
    `Local branches: ${state.localBranches.join(', ') || '(none)'}`,
    `Remote branches: ${state.hasRemote ? state.remoteBranches.join(', ') : '(no remote)'}`,
    `Tracked files: ${state.trackedFiles.length} (${(sizeReport.totalBytes / MB).toFixed(2)} MB total)`,
    'Largest 5 tracked files:',
    ...sizeReport.largestFive.map((f, i) => `  ${i + 1}. ${f.path} (${formatKb(f.size)})`),
  ];

  for (const w of warnings) {
    lines.push(`WARN: ${w}`);
  }
  for (const err of errors) {
    lines.push(`FAIL: ${err}`);
  }
  lines.push(errors.length === 0 ? 'Result: PASS' : `Result: FAIL (${errors.length} error(s))`);

  process.stdout.write(`${lines.join('\n')}\n`);
  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main();
