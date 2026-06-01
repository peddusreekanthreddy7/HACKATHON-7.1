/** A rectangle in normalized [0,1] coordinates, origin = top-left of the frame. */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A detected face with its normalized bounding box and confidence [0,1]. */
export interface DetectedFace {
  bbox: NormalizedRect;
  score: number;
}

/** A single SSD anchor (normalized center + size). */
export interface Anchor {
  xCenter: number;
  yCenter: number;
  w: number;
  h: number;
}

/** Tunables for decoding raw BlazeFace tensors into faces. Verify on device. */
export interface DecodeOptions {
  /** Model input side length (BlazeFace short-range = 128). */
  inputSize: number;
  /** Min sigmoid confidence to keep a detection. */
  scoreThreshold: number;
  /** IoU above which overlapping boxes are merged by NMS. */
  iouThreshold: number;
  /** Hard cap on returned faces (we only need the most prominent one). */
  maxFaces: number;
}
