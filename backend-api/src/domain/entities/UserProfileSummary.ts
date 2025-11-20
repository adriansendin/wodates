/**
 * UserProfileSummary entity
 * 
 * Represents a consolidated textual summary and embedding for a user's personality,
 * communication style, preferences, etc. Generated asynchronously by AI.
 */
export interface UserProfileSummary {
  id: string;
  userId: string;
  summary: string;
  embedding: number[];
  provider: string;
  model?: string;
  dimension: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserProfileSummary {
  userId: string;
  summary: string;
  embedding: number[];
  provider: string;
  model?: string;
  dimension: number;
}

export interface UpdateUserProfileSummary {
  summary: string;
  embedding: number[];
  provider: string;
  model?: string;
  dimension: number;
}

