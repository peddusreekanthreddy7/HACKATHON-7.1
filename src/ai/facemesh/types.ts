/** A single Face Mesh landmark in normalized [0,1] crop-local coordinates. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/** MediaPipe Face Mesh output: 468 landmarks. */
export type FaceLandmarks = Landmark[];
