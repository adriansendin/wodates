import { GENDER_VALUES } from '../../../../domain/entities/User';
import { LOOKING_FOR_VALUES } from '../../../../domain/entities/LookingFor';

export type ProfileFactoryAttributes = {
  birthDate: string;
  gender?: (typeof GENDER_VALUES)[number];
  location?: string;
  country?: string;
  lookingFor?: (typeof LOOKING_FOR_VALUES)[number];
};

const cities = [
  'Madrid',
  'Barcelona',
  'Valencia',
  'Sevilla',
  'Bilbao',
] as const;

export class ProfileFactory {
  static create(
    overrides: Partial<ProfileFactoryAttributes> = {}
  ): ProfileFactoryAttributes {
    const year = 1990 + Math.floor(Math.random() * 10);
    const month = Math.floor(Math.random() * 12);
    const day = Math.max(1, Math.floor(Math.random() * 28));
    const birthDate = new Date(Date.UTC(year, month, day)).toISOString();
    return {
      birthDate: overrides.birthDate ?? birthDate,
      gender: overrides.gender ?? 'male',
      location:
        overrides.location ??
        cities[Math.floor(Math.random() * cities.length)] ??
        'Madrid',
      country: overrides.country ?? 'Spain',
      lookingFor: overrides.lookingFor ?? 'female',
    };
  }
}
