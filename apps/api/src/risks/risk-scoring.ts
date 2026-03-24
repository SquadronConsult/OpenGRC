/** Likelihood and impact are 1–5; scores are product. */

export function clampLhi(n: number): number {
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function inherentScore(likelihood: number, impact: number): number {
  return clampLhi(likelihood) * clampLhi(impact);
}

export function riskBand(score: number): 'low' | 'moderate' | 'high' | 'critical' {
  if (score <= 5) return 'low';
  if (score <= 12) return 'moderate';
  if (score <= 20) return 'high';
  return 'critical';
}

export function residualNeedsOverride(
  inherent: number,
  residual: number,
): boolean {
  return residual > inherent;
}
