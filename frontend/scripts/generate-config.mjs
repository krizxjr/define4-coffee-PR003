import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const envPath = path.join(projectDir, '.env');

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed[0] === '"' && trimmed.at(-1) === '"') || (trimmed[0] === "'" && trimmed.at(-1) === "'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = unquote(line.slice(separator + 1));
    values[key] = value;
  }
  return values;
}

const fileEnv = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : {};
const get = (key, fallback = '') => String(process.env[key] ?? fileEnv[key] ?? fallback).trim();
const truthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());

const config = {
  API_BASE_URL: get('VITE_API_BASE_URL'),
  SUPABASE_URL: get('VITE_SUPABASE_URL'),
  SUPABASE_ANON_KEY: get('VITE_SUPABASE_PUBLISHABLE_KEY') || get('VITE_SUPABASE_ANON_KEY'),
  REQUIRE_AUTH: truthy(get('VITE_REQUIRE_AUTH', 'true')),
};

const output = `/* Generated from .env by scripts/generate-config.mjs. Do not edit manually.\n` +
  `   Browser-visible configuration only; never place private server secrets here. */\n` +
  `window.OPEN_ATTIC_CONFIG = Object.freeze(${JSON.stringify(config, null, 2)});\n`;
fs.writeFileSync(path.join(projectDir, 'js', 'config.js'), output, 'utf8');
console.log('Generated js/config.js from frontend environment settings.');
if (!fs.existsSync(envPath)) {
  console.warn('No .env file found; using safe defaults (demo mode). Copy .env.example to .env to configure the frontend.');
}
if (config.REQUIRE_AUTH && (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY)) {
  console.warn('VITE_REQUIRE_AUTH is true, but VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY) is missing.');
}
if (config.REQUIRE_AUTH && !config.API_BASE_URL) {
  console.warn('VITE_REQUIRE_AUTH is true but VITE_API_BASE_URL is blank. Per-user storage requires the authenticated Flask API; demo localStorage is not per-user server storage.');
}
