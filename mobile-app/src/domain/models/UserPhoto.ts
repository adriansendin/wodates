import { z } from 'zod';

export const UserPhotoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  storage_path: z.string(),
  public_url: z.string().url(),
  is_main: z.boolean(),
  position: z.number().int().min(0).max(4),
  created_at: z.string().datetime(),
});

export type UserPhoto = z.infer<typeof UserPhotoSchema>;

export type CreateUserPhotoInput = {
  user_id: string;
  storage_path: string;
  public_url: string;
  is_main: boolean;
  position: number;
};

export type UpdateUserPhotoInput = {
  is_main?: boolean;
  position?: number;
};





