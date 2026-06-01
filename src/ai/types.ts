/** Static description of an on-device model — drives the footprint ledger. */
export interface ModelSpec {
  key: string;
  /** Filename under /models. */
  file: string;
  purpose: string;
  /** Size in MB; null until the quantized file is added (Phase 2+). */
  sizeMb: number | null;
  /** SPDX identifier — must be permissive (MIT/Apache/BSD), hard constraint #6. */
  license: string;
  /** Upstream source URL. */
  source: string;
  /** Quantization scheme, e.g. INT8 / FP16. */
  quantization: string;
}
