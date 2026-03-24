/* eslint-disable no-console */
/** Mirrors apps/api/src/risks/risk-scoring.ts — run without API: `node scripts/risk-scoring-smoke.mjs` */

function clampLhi(n) {
  return Math.min(5, Math.max(1, Math.round(n)));
}

function inherentScore(likelihood, impact) {
  return clampLhi(likelihood) * clampLhi(impact);
}

function riskBand(score) {
  if (score <= 5) return 'low';
  if (score <= 12) return 'moderate';
  if (score <= 20) return 'high';
  return 'critical';
}

function residualNeedsOverride(inherent, residual) {
  return residual > inherent;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(inherentScore(3, 4) === 12, '3×4 inherent');
  assert(riskBand(12) === 'moderate', 'band 12');
  assert(riskBand(25) === 'critical', 'band 25');
  assert(residualNeedsOverride(12, 15) === true, 'override when residual > inherent');
  assert(residualNeedsOverride(12, 4) === false, 'no override');
  assert(clampLhi(0) === 1 && clampLhi(99) === 5, 'clamp');
  console.log('OK risk-scoring-smoke');
}

run();
