export {
  dequantiseInt8,
  l2Normalize,
  decodeEmbedding,
  averageEmbeddings,
  embeddingToBuffer,
  bufferToEmbedding,
} from './decode';
export {
  cosineSimilarity,
  findBestMatch,
  scoreToConfidence,
  type EnrolledRecord,
} from './match';
export {
  DEFAULT_EMBEDDING_CONFIG,
  type Embedding,
  type MatchResult,
  type EmbeddingConfig,
} from './types';
