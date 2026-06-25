import type { APIRoute } from 'astro';
import { getJourneys, saveJourneys, writeFile } from '../../lib/content.ts';
import { gitCommit, COPY_DIR } from '../../lib/git.ts';
import path from 'path';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { scope, path: filePath, slug, data, note } = body;
    const commitNote = note?.trim() || 'Import';

    if (scope === 'page') {
      if (!filePath) return err('path required', 400);
      if (!isValidCopyFile(data)) return err('Invalid page data', 400);
      const resolved = path.resolve(COPY_DIR, filePath);
      if (!resolved.startsWith(COPY_DIR)) return err('Invalid path', 400);
      writeFile(filePath, data);
      gitCommit(filePath, commitNote);
      return ok(1);
    }

    if (scope === 'journey') {
      if (!slug) return err('slug required', 400);
      if (!data?.journey || !Array.isArray(data?.pages)) return err('Invalid journey data', 400);
      let count = 0;
      for (const page of data.pages) {
        if (!page.path || !isValidCopyFile(page.data)) continue;
        if (!page.path.startsWith(slug + '/')) continue;
        const resolved = path.resolve(COPY_DIR, page.path);
        if (!resolved.startsWith(COPY_DIR)) continue;
        writeFile(page.path, page.data);
        gitCommit(page.path, commitNote);
        count++;
      }
      return ok(count);
    }

    if (scope === 'all') {
      if (!Array.isArray(data?.journeys) || !Array.isArray(data?.pages)) {
        return err('Invalid export data', 400);
      }
      saveJourneys(data.journeys);
      gitCommit('journeys.json', commitNote);
      let count = 0;
      for (const page of data.pages) {
        if (!page.path || !isValidCopyFile(page.data)) continue;
        const resolved = path.resolve(COPY_DIR, page.path);
        if (!resolved.startsWith(COPY_DIR)) continue;
        writeFile(page.path, page.data);
        gitCommit(page.path, commitNote);
        count++;
      }
      return ok(count);
    }

    return err('scope must be page, journey, or all', 400);
  } catch (e) {
    return err(String(e), 500);
  }
};

function isValidCopyFile(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return typeof d.meta === 'object' && typeof d.items === 'object';
}

function ok(count: number) {
  return new Response(JSON.stringify({ ok: true, count }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function err(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
