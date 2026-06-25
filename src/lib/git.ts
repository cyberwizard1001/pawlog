import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const COPY_DIR = process.env.COPY_DIR ?? path.resolve(__dirname, '../../copy');

function run(cmd: string, cwd = COPY_DIR): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

export interface LogEntry {
  hash: string;
  date: string;
  message: string;
}

export function gitLog(relPath: string): LogEntry[] {
  const raw = run(`git log --pretty=format:"%H|||%aI|||%s" -- "${relPath}"`);
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map(line => {
    const [hash, date, ...rest] = line.split('|||');
    return { hash: hash.trim(), date: date.trim(), message: rest.join('|||').trim() };
  });
}

export function gitShow(hash: string, relPath: string): string {
  return run(`git show ${hash}:"${relPath}"`);
}

export function gitDiff(from: string, to: string, relPath: string): string {
  return run(`git diff ${from} ${to} -- "${relPath}"`);
}

export function gitCommit(relPath: string, note: string): void {
  run(`git add "${relPath}"`);
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const msg = note.trim()
    ? `${note.trim()} — ${ts}`
    : `Updated ${path.basename(relPath)} — ${ts}`;
  run(`git commit -m "${msg.replace(/"/g, "'")}"`);
}

export function gitDelete(relPath: string, note: string): void {
  run(`git rm "${relPath}"`);
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const msg = note.trim()
    ? `${note.trim()} — ${ts}`
    : `Deleted ${path.basename(relPath)} — ${ts}`;
  run(`git commit -m "${msg.replace(/"/g, "'")}"`);
}

export function gitDeleteJourney(slug: string, note: string): void {
  run(`git rm -r --ignore-unmatch "${slug}"`);
  run(`git add journeys.json`);
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const msg = `${note.trim()} — ${ts}`;
  run(`git commit -m "${msg.replace(/"/g, "'")}"`);
}

export function isGitRepo(): boolean {
  return run('git rev-parse --is-inside-work-tree') === 'true';
}

export interface RecentCommit extends LogEntry {
  files: string[];
}

export function gitRecentLog(limit = 25): RecentCommit[] {
  const raw = run(`git log --pretty=format:"---COMMIT---%H|||%aI|||%s" --name-only -${limit}`);
  if (!raw) return [];
  return raw.split('---COMMIT---').filter(Boolean).map(block => {
    const lines = block.split('\n').filter(l => l.trim());
    const [hash, date, ...rest] = lines[0].split('|||');
    const files = lines.slice(1).filter(l => !l.startsWith(' '));
    return { hash: hash.trim(), date: date.trim(), message: rest.join('|||').trim(), files };
  });
}
