#!/usr/bin/env node
/**
 * CI gate for hard constraint #2: the total on-device model footprint must
 * stay at/under the budget. Exits non-zero if exceeded so the build fails loudly.
 *
 *   npm run verify:models
 */
const fs = require('fs');
const path = require('path');

const BUDGET_MB = 20;
const MODELS_DIR = path.join(__dirname, '..', 'models');
const MODEL_EXTS = ['.tflite', '.onnx', '.bin'];

function main() {
  if (!fs.existsSync(MODELS_DIR)) {
    console.error('✗ models/ directory not found');
    process.exit(1);
  }

  const files = fs
    .readdirSync(MODELS_DIR)
    .filter(f => MODEL_EXTS.includes(path.extname(f).toLowerCase()));

  let totalBytes = 0;
  console.log('On-device model footprint:');
  for (const file of files) {
    const bytes = fs.statSync(path.join(MODELS_DIR, file)).size;
    totalBytes += bytes;
    console.log(`  ${file.padEnd(34)} ${(bytes / 1e6).toFixed(2)} MB`);
  }
  if (files.length === 0) {
    console.log('  (no model files yet — added in Phase 2+)');
  }

  const totalMb = totalBytes / 1e6;
  console.log(`\nTotal: ${totalMb.toFixed(2)} MB / ${BUDGET_MB} MB budget`);

  if (totalMb > BUDGET_MB) {
    console.error(
      `✗ Footprint ${totalMb.toFixed(2)} MB exceeds the ${BUDGET_MB} MB budget (constraint #2).`,
    );
    process.exit(1);
  }
  console.log('✓ Within budget.');
}

main();
