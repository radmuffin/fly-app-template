#!/usr/bin/env node

/**
 * ⚡ Smart Affected Test Runner for Fly App Template
 *
 * Inspects git diffs (staged, unstaged, or branch diffs against origin/main or trunk)
 * and executes ONLY the test suites and linters directly affected by your changes.
 *
 * Usage:
 *   node scripts/test-affected.js
 *   node scripts/test-affected.js --base=origin/main
 *   node scripts/test-affected.js --staged
 *   node scripts/test-affected.js --all
 *   node scripts/test-affected.js --dry-run
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const runAll = args.includes('--all');
const stagedOnly = args.includes('--staged');
const baseArg = args.find((a) => a.startsWith('--base='));
const baseBranch = baseArg ? baseArg.split('=')[1] : 'origin/main';

function getChangedFiles() {
  if (runAll) return null;

  const changed = new Set();

  try {
    const statusOut = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    if (statusOut) {
      statusOut.split('\n').forEach((line) => {
        const match = line.match(/^.{2}\s+(.+)$/);
        if (match) {
          const file = match[1].trim().replace(/^"|"$/g, '');
          if (file) changed.add(file);
        }
      });
    }
  } catch (_) {}

  if (stagedOnly) {
    return Array.from(changed);
  }

  try {
    const diffBase = execSync(`git diff --name-only ${baseBranch}...HEAD`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (diffBase) {
      diffBase.split('\n').forEach((f) => {
        const trimmed = f.trim();
        if (trimmed) changed.add(trimmed);
      });
    }
  } catch (_) {
    try {
      const diffHead = execSync('git diff --name-only HEAD~1', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (diffHead) {
        diffHead.split('\n').forEach((f) => {
          const trimmed = f.trim();
          if (trimmed) changed.add(trimmed);
        });
      }
    } catch (_) {}
  }

  return Array.from(changed);
}

function resolveAffectedTests(changedFiles) {
  const plan = {
    rustFmt: false,
    rustClippy: false,
    rustFull: false,
    rustFilters: new Set(),
    description: []
  };

  if (!changedFiles || changedFiles.length === 0) {
    plan.description.push('No changed files detected. Running standard baseline test verification.');
    plan.rustFull = true;
    plan.rustClippy = true;
    plan.rustFmt = true;
    return plan;
  }

  for (const file of changedFiles) {
    const norm = file.replace(/\\/g, '/');

    if (
      norm === 'Cargo.toml' ||
      norm === 'Cargo.lock' ||
      norm === 'package.json' ||
      norm.startsWith('.github/') ||
      norm.endsWith('Dockerfile')
    ) {
      plan.description.push(`Critical build/manifest change: ${norm}`);
      plan.rustFull = true;
      plan.rustClippy = true;
      plan.rustFmt = true;
      return plan;
    }

    if (norm.endsWith('.rs')) {
      plan.rustFmt = true;
      plan.rustClippy = true;
      plan.rustFull = true;
      plan.description.push(`Rust change: ${norm}`);
    }
  }

  return plan;
}

function runCommand(cmd, label) {
  console.log(`\n\x1b[36m▶ [Affected Test Runner] ${label}\x1b[0m`);
  console.log(`\x1b[90m$ ${cmd}\x1b[0m`);

  if (isDryRun) {
    console.log(`\x1b[33m(Dry Run) Skipped execution\x1b[0m`);
    return true;
  }

  const result = spawnSync(cmd, { shell: true, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\n\x1b[31m✖ ${label} FAILED with exit code ${result.status}\x1b[0m\n`);
    return false;
  }
  return true;
}

function main() {
  console.log('\x1b[1m\x1b[35m=== ⚡ Fly App Affected Test Matrix ===\x1b[0m');

  const changed = getChangedFiles();
  const plan = resolveAffectedTests(changed);

  if (changed && changed.length > 0) {
    console.log(`\x1b[90mFound ${changed.length} modified file(s):\x1b[0m`);
    changed.forEach((f) => console.log(`  • ${f}`));
  }

  let passed = true;

  if (plan.rustFmt) {
    passed = passed && runCommand('cargo fmt --all -- --check', 'Rust Code Formatting Check');
    if (!passed) process.exit(1);
  }

  if (plan.rustFull) {
    passed = passed && runCommand('cargo test', 'Rust Backend Test Suite');
    if (!passed) process.exit(1);
  }

  if (plan.rustClippy) {
    passed = passed && runCommand('cargo clippy --all-targets', 'Rust Clippy Linter Check');
    if (!passed) process.exit(1);
  }

  console.log('\n\x1b[32m✔ All affected tests and checks passed cleanly! Safe to commit & push.\x1b[0m\n');
}

main();
