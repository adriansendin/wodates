import { randomUUID } from 'crypto';
import { Preferences } from '../../../../domain/entities/Preferences';
import { Gender } from '../../../../domain/entities/User';

type PreferencesFactoryOptions = {
  userId: string;
  ageMin?: number;
  ageMax?: number;
  genderFilter?: Gender[];
  maxDistance?: number;
};

export class PreferencesFactory {
  static create({
    userId,
    ageMin = 24,
    ageMax = 36,
    genderFilter = ['female'],
    maxDistance = 50,
  }: PreferencesFactoryOptions): Preferences {
    const timestamp = new Date().toISOString();

    return {
      id: randomUUID(),
      userId,
      ageMin,
      ageMax,
      genderFilter,
      maxDistance,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}
