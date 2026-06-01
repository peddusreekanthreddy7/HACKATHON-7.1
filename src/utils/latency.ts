/**
 * Per-frame inference latency logger.
 * Stamps are collected in the worklet / JS thread; the summary is formatted
 * for PERFORMANCE_BENCHMARKS.md and console-logged on the JS thread.
 * Raw data is also available for the Admin screen.
 */

export interface LatencyStamps {
  frameAcquired: number;
  detectDone: number;
  landmarkDone: number;
  alignDone: number;
  embedDone: number;
  matchDone: number;
}

export interface LatencyBreakdown {
  detectMs: number;
  landmarkMs: number;
  alignMs: number;
  embedMs: number;
  matchMs: number;
  totalMs: number;
}

export function calcLatency(s: LatencyStamps): LatencyBreakdown {
  return {
    detectMs: s.detectDone - s.frameAcquired,
    landmarkMs: s.landmarkDone - s.detectDone,
    alignMs: s.alignDone - s.landmarkDone,
    embedMs: s.embedDone - s.alignDone,
    matchMs: s.matchDone - s.embedDone,
    totalMs: s.matchDone - s.frameAcquired,
  };
}

export interface LatencyStats {
  count: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
}

/** Welford running statistics — no need to store all samples. */
export class RunningStats {
  private n = 0;
  private mean = 0;
  private m2 = 0;
  private min = Infinity;
  private max = -Infinity;

  push(x: number): void {
    this.n++;
    const delta = x - this.mean;
    this.mean += delta / this.n;
    this.m2 += delta * (x - this.mean);
    if (x < this.min) this.min = x;
    if (x > this.max) this.max = x;
  }

  get stats(): LatencyStats {
    return {
      count: this.n,
      meanMs: Math.round(this.mean * 10) / 10,
      minMs: Math.round(this.min),
      maxMs: Math.round(this.max),
    };
  }
}

/** Format a latency breakdown as a Markdown table row for PERFORMANCE_BENCHMARKS.md. */
export function formatBenchmarkRow(b: LatencyBreakdown): string {
  const f = (n: number) => `${Math.round(n)} ms`;
  return (
    `| Frame + preprocess | — | ${f(b.detectMs)} |\n` +
    `| Face detect (BlazeFace) | — | ${f(b.detectMs)} |\n` +
    `| Landmarks (Face Mesh) | — | ${f(b.landmarkMs)} |\n` +
    `| Alignment (5-pt warp) | — | ${f(b.alignMs)} |\n` +
    `| Embedding (MobileFaceNet INT8) | — | ${f(b.embedMs)} |\n` +
    `| Match + bookkeeping | — | ${f(b.matchMs)} |\n` +
    `| **Passive total** | **< 1000 ms** | **${f(b.totalMs)}** |`
  );
}
