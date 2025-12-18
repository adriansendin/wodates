/**
 * AI Service HTTP Clients
 *
 * Thin HTTP clients for communicating with the external ai-service.
 * Each client has a single responsibility: send input → receive output.
 * No business logic, no complex validations, basic error handling.
 */

export {
  AiServiceChatClient,
  type AiServiceChatRequest,
  type AiServiceChatResponse,
} from './AiServiceChatClient';

export {
  AiServiceProfileClient,
  type AiServiceGenerateProfileRequest,
  type AiServiceGenerateProfileResponse,
  type AiServiceMergeProfilesRequest,
  type AiServiceMergeProfilesResponse,
} from './AiServiceProfileClient';

export {
  AiServiceEmbeddingClient,
  type AiServiceGenerateEmbeddingRequest,
  type AiServiceGenerateEmbeddingResponse,
} from './AiServiceEmbeddingClient';
