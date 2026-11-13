/**
 * AttendoSchool — Git Branch Sync Analysis Logic
 *
 * Provides robust calculation and reporting of branch synchronization states.
 * Enforces Phase 2 status calculation rules:
 * - ahead = 0 and behind = 0 → Up-to-date
 * - ahead > 0 and behind = 0 → Ahead
 * - ahead = 0 and behind > 0 → Behind
 * - ahead > 0 and behind > 0 → Diverged
 * - Git comparison failure → Unknown / Error
 */

import { execSync } from 'child_process';

export type SyncStatusType = 'Up-to-date' | 'Ahead' | 'Behind' | 'Diverged' | 'Unknown / Error';

export interface BranchComparisonResult {
  branch: string;
  target: string;
  ahead: number | null;
  behind: number | null;
  status: SyncStatusType;
  conflicts: string;
  error?: string;
  mergeBase?: string | null;
}

/**
 * Calculates branch synchronization status strictly according to specification:
 * - ahead = 0 and behind = 0 → Up-to-date
 * - ahead > 0 and behind = 0 → Ahead
 * - ahead = 0 and behind > 0 → Behind
 * - ahead > 0 and behind > 0 → Diverged
 * - Git comparison failure → Unknown / Error
 *
 * Never returns 'Up-to-date' when ahead > 0 or behind > 0.
 */
export function calculateSyncStatus(
  ahead: number | null | undefined,
  behind: number | null | undefined,
  error?: boolean | string
): SyncStatusType {
  if (
    error ||
    ahead === null ||
    ahead === undefined ||
    behind === null ||
    behind === undefined ||
    isNaN(ahead) ||
    isNaN(behind) ||
    ahead < 0 ||
    behind < 0
  ) {
    return 'Unknown / Error';
  }

  if (ahead === 0 && behind === 0) {
    return 'Up-to-date';
  }
  if (ahead > 0 && behind === 0) {
    return 'Ahead';
  }
  if (ahead === 0 && behind > 0) {
    return 'Behind';
  }
  if (ahead > 0 && behind > 0) {
    return 'Diverged';
  }

  return 'Unknown / Error';
}

/**
 * Compares two Git references using `git rev-list --left-right --count <branch>...<target>`
 */
export function compareBranches(
  branchRef: string,
  targetRef: string,
  execFn: (cmd: string) => string = (cmd) => execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] }).toString()
): BranchComparisonResult {
  const result: BranchComparisonResult = {
    branch: branchRef,
    target: targetRef,
    ahead: null,
    behind: null,
    status: 'Unknown / Error',
    conflicts: '—'
  };

  try {
    // 1. Verify target reference exists
    try {
      execFn(`git rev-parse --verify "${targetRef}"`);
    } catch {
      result.error = `Target reference '${targetRef}' not found`;
      result.conflicts = '❓';
      return result;
    }

    // 2. Verify branch reference exists
    try {
      execFn(`git rev-parse --verify "${branchRef}"`);
    } catch {
      result.error = `Branch reference '${branchRef}' not found`;
      result.conflicts = '❓';
      return result;
    }

    // 3. Count ahead and behind using symmetric difference
    const countOutput = execFn(`git rev-list --left-right --count "${branchRef}...${targetRef}"`).trim();
    const parts = countOutput.split(/\s+/);
    if (parts.length < 2) {
      result.error = `Invalid count output: '${countOutput}'`;
      return result;
    }

    const ahead = parseInt(parts[0], 10);
    const behind = parseInt(parts[1], 10);

    result.ahead = isNaN(ahead) ? null : ahead;
    result.behind = isNaN(behind) ? null : behind;
    result.status = calculateSyncStatus(result.ahead, result.behind);

    // 4. Determine conflict status based on synchronization status
    if (result.status === 'Up-to-date' || result.status === 'Behind') {
      result.conflicts = '—';
    } else if (result.status === 'Ahead') {
      result.conflicts = '✅ None (Fast-forward)';
    } else if (result.status === 'Diverged') {
      // Find merge base
      try {
        const mb = execFn(`git merge-base "${targetRef}" "${branchRef}"`).trim();
        result.mergeBase = mb || null;
      } catch {
        result.mergeBase = null;
      }

      if (!result.mergeBase) {
        result.conflicts = '❓ No common ancestor';
      } else {
        result.conflicts = 'Check required';
      }
    }
  } catch (err: any) {
    result.error = err.message || String(err);
    result.status = 'Unknown / Error';
    result.conflicts = '❓';
  }

  return result;
}

/**
 * Formats a Markdown table row for branch sync report
 */
export function formatSyncMarkdownRow(res: BranchComparisonResult): string {
  const aheadStr = res.ahead !== null ? String(res.ahead) : '?';
  const behindStr = res.behind !== null ? String(res.behind) : '?';

  let statusBadge = res.status;
  if (res.status === 'Up-to-date') statusBadge = '✅ Up-to-date';
  else if (res.status === 'Ahead') statusBadge = '🚀 Ahead';
  else if (res.status === 'Behind') statusBadge = '📥 Behind';
  else if (res.status === 'Diverged') statusBadge = '🔀 Diverged';
  else statusBadge = '❌ Unknown / Error';

  return `| \`${res.branch}\` | \`${res.target}\` | ${aheadStr} | ${behindStr} | ${res.conflicts} | ${statusBadge} |`;
}
