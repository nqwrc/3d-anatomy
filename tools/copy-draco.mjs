/**
 * Copies the Draco decoder shipped with the installed `three` package into
 * public/draco/, which is what DRACOLoader fetches at runtime
 * (see src/viewer/loadModel.js: dracoLoader.setDecoderPath('/draco/')).
 *
 * Run automatically by the "postinstall" npm script so the vendored copy can
 * never drift from the installed three version. Safe to run by hand:
 *   node tools/copy-draco.mjs
 *
 * Cross-platform: uses node:path and node:fs only, no shell commands.
 */

import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const threeRoot = join(projectRoot, 'node_modules', 'three');
const sourceDir = join(threeRoot, 'examples', 'jsm', 'libs', 'draco', 'gltf');
const targetDir = join(projectRoot, 'public', 'draco');

async function readThreeVersion() {
  try {
    const pkg = JSON.parse(await readFile(join(threeRoot, 'package.json'), 'utf8'));
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

async function main() {
  let entries;
  try {
    entries = await readdir(sourceDir);
  } catch (error) {
    console.error(`copy-draco: cannot read the Draco decoder at ${sourceDir}`);
    console.error('copy-draco: install dependencies first (npm install), then re-run.');
    console.error(`copy-draco: underlying error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const files = entries.filter((name) => name.startsWith('draco_'));
  if (files.length === 0) {
    console.error(`copy-draco: no draco_* files found in ${sourceDir}`);
    process.exitCode = 1;
    return;
  }

  await mkdir(targetDir, { recursive: true });
  for (const name of files) {
    await copyFile(join(sourceDir, name), join(targetDir, name));
  }

  const version = await readThreeVersion();
  console.log(
    `copy-draco: copied ${files.length} file(s) from three@${version} into public/draco/ (${files.join(', ')})`
  );
}

await main();
