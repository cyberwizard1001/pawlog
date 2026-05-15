/**
 * @module page
 * @description POST /api/page — creates a new page (JSON file) within a journey. Body: { journey, slug, page, description? }.
 *              PATCH /api/page — edits page metadata. Body: { path, page, description? }.
 *              DELETE /api/page — deletes a page and commits the removal. Body: { path }.
 */
import type { APIRoute } from 'astro';
import { writeFile, readFile } from '../../lib/content.ts';
import { gitCommit, gitDelete, COPY_DIR } from '../../lib/git.ts';
import path from 'path';
import fs from 'fs';

export const POST: APIRoute = async ({ request }) => {
  const { journey, slug, page, description } = await request.json();

  if (!journey || !slug || !page) {
    return new Response(JSON.stringify({ error: 'journey, slug, and page are required' }), { status: 400 });
  }
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    return new Response(JSON.stringify({ error: 'Slug must be lowercase letters and hyphens only' }), { status: 400 });
  }

  const relPath = `${journey}/${slug}.json`;
  if (fs.existsSync(path.join(COPY_DIR, relPath))) {
    return new Response(JSON.stringify({ error: 'A page with that slug already exists' }), { status: 409 });
  }

  const data = {
    meta: {
      page,
      ...(description?.trim() ? { description: description.trim() } : {}),
    },
    items: {},
  };

  writeFile(relPath, data);
  gitCommit(relPath, `Create ${page}`);

  return new Response(JSON.stringify({ path: relPath }), { status: 201 });
};

export const PATCH: APIRoute = async ({ request }) => {
  const { path: relPath, page, description } = await request.json();
  if (!relPath || !page) {
    return new Response(JSON.stringify({ error: 'path and page are required' }), { status: 400 });
  }
  const full = path.join(COPY_DIR, relPath);
  if (!fs.existsSync(full)) {
    return new Response(JSON.stringify({ error: 'Page not found' }), { status: 404 });
  }
  const data = readFile(relPath);
  if (!data) {
    return new Response(JSON.stringify({ error: 'Could not read page file' }), { status: 500 });
  }
  data.meta.page = page.trim();
  if (description?.trim()) {
    data.meta.description = description.trim();
  } else {
    delete data.meta.description;
  }
  writeFile(relPath, data);
  gitCommit(relPath, `Update page meta: ${page.trim()}`);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

export const DELETE: APIRoute = async ({ request }) => {
  const { path: relPath } = await request.json();
  if (!relPath) {
    return new Response(JSON.stringify({ error: 'path is required' }), { status: 400 });
  }
  const full = path.join(COPY_DIR, relPath);
  if (!fs.existsSync(full)) {
    return new Response(JSON.stringify({ error: 'Page not found' }), { status: 404 });
  }
  gitDelete(relPath, `Delete page: ${path.basename(relPath, '.json')}`);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
