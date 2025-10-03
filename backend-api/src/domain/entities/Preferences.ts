import { z } from 'zod';
import { GenderSchema } from './User';

export const PreferencesSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  ageMin: z.number().min(18).max(100),
  ageMax: z.number().min(18).max(100),
  genderFilter: z.array(GenderSchema),
  maxDistance: z.number().min(1).max(1000), // in kilometers
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreatePreferencesSchema = PreferencesSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdatePreferencesSchema = CreatePreferencesSchema.partial();

export type Preferences = z.infer<typeof PreferencesSchema>;
export type CreatePreferences = z.infer<typeof CreatePreferencesSchema>;
export type UpdatePreferences = z.infer<typeof UpdatePreferencesSchema>;
