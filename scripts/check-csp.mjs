#!/usr/bin/env node
/**
 * Post-build CSP guard. public/_headers ships `script-src 'self' …` with no 'unsafe-inline' and
 * no hashes, so any executable inline <script>, inline on* handler, or javascript: URL in the
 * built HTML would be blocked in production. Fail the build instead of shipping a broken page.
 *
 * Allowed: <script src=…>, and non-executable data blocks (application/ld+json, application/json).
 * Usage: node scripts/check-csp.mjs [distDir]   (after `astro build`)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), '..');

const DATA_SCRIPT_TYPES = new Set(['application/ld+json', 'application/json']);

function walkHtml(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function attr(tag, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

/** Returns a list of human-readable CSP violations for one HTML document. Pure. */
export function findCspViolations(html) {
  const problems = [];
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = scriptRe.exec(html))) {
    const openTag = `<script${m[1]}>`;
    const src = attr(openTag, 'src');
    const type = (attr(openTag, 'type') ?? '').trim().toLowerCase();
    if (src !== null) {
      if (m[2].trim()) problems.push('script with both src and inline body');
      continue;
    }
    if (DATA_SCRIPT_TYPES.has(type)) continue;
    if (!m[2].trim()) continue;
    problems.push(`inline <script${type ? ` type="${type}"` : ''}> (${m[2].trim().slice(0, 60)}…)`);
  }
  // Strip script/style bodies before scanning attributes
  const markup = html.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '');
  const tagRe = /<[a-z][^>]*>/gi;
  while ((m = tagRe.exec(markup))) {
    const tag = m[0];
    const handler = /\son[a-z]+\s*=/i.exec(tag);
    if (handler) problems.push(`inline event handler ${handler[0].trim()} in ${tag.slice(0, 80)}`);
    if (/\s(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:/i.test(tag)) {
      problems.push(`javascript: URL in ${tag.slice(0, 80)}`);
    }
  }
  return problems;
}

export function checkDist(distDir = path.join(ROOT_DIR, 'dist')) {
  const files = walkHtml(distDir);
  if (files.length === 0) throw new Error(`check-csp: no HTML found under ${distDir}`);
  const failures = [];
  for (const file of files) {
    for (const problem of findCspViolations(fs.readFileSync(file, 'utf8'))) {
      failures.push(`${path.relative(distDir, file)}: ${problem}`);
    }
  }
  return { files: files.length, failures };
}

const isMain = typeof process.argv[1] === 'string' && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const distDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT_DIR, 'dist');
  const { files, failures } = checkDist(distDir);
  if (failures.length > 0) {
    console.error(`[check-csp] ${failures.length} CSP violation(s) in built HTML:`);
    for (const f of failures.slice(0, 50)) console.error(`  - ${f}`);
    console.error("Move inline code into a bundled <script> (Astro hoists it to /_astro) or a data block.");
    process.exit(1);
  }
  console.log(`[check-csp] ${files} HTML files: no inline scripts or handlers (script-src 'self' safe)`);
}
