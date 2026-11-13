#!/usr/bin/env node
/**
 * AttendoSchool — Branch Synchronization Analysis CLI Tool
 * Runs locally or in CI to inspect and report remote branch synchronization.
 *
 * Usage:
 *   npx tsx scripts/run-branch-sync-analysis.ts [targetBranch] [sourceBranch]
 *   Example: npx tsx scripts/run-branch-sync-analysis.ts main
 */

import { execSync } from 'child_process';
import { compareBranches, formatSyncMarkdownRow } from './branch-sync-logic';

function run() {
  const target = process.argv[2] || 'main';
  const targetRef = `origin/${target}`;
  const sourceFilter = process.argv[3];

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   ATTENDOSCHOOL — BRANCH SYNCHRONIZATION ANALYSIS            `);
  console.log(`   Target Comparison Reference: ${targetRef}                 `);
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('Fetching remote state with git fetch origin --prune ...');
  try {
    execSync('git fetch origin --prune', { stdio: 'inherit' });
    console.log('✔ Remote fetch completed successfully.\n');
  } catch (err: any) {
    console.error('❌ FATAL: git fetch origin --prune failed. Remote tracking state may be stale.\n');
    process.exit(1);
  }

  // Verify target reference
  try {
    execSync(`git rev-parse --verify "${targetRef}"`, { stdio: 'ignore' });
  } catch {
    console.error(`❌ FATAL: Target branch '${targetRef}' does not exist on origin.`);
    process.exit(1);
  }

  // List branches
  let branches: string[] = [];
  if (sourceFilter) {
    branches = [`origin/${sourceFilter}`];
  } else {
    const raw = execSync('git branch -r', { encoding: 'utf8' });
    branches = raw
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && !s.includes('->') && s !== targetRef && !s.includes('origin/gh-pages'));
  }

  console.log('| Branch | Comparison Target | Ahead | Behind | Conflicts | Status |');
  console.log('| :--- | :--- | :---: | :---: | :---: | :--- |');

  for (const b of branches) {
    const res = compareBranches(b, targetRef);
    console.log(formatSyncMarkdownRow(res));
  }

  console.log('\n---');
  console.log('*Read-only analysis complete. No branches were modified.*');
}

run();
