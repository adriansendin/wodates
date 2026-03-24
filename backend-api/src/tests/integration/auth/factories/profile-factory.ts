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
    const currentYear = new Date().getUTCFullYear();
    const minBirthYear = currentYear - 65;
    const maxBirthYear = currentYear - 29;
    const year =
      minBirthYear +
      Math.floor(Math.random() * (maxBirthYear - minBirthYear + 1));
    // Fixed Jan 1 so random year always yields age in [29, 65] (avoids "not yet birthday" underflow)
    const birthDate = new Date(Date.UTC(year, 0, 1)).toISOString();
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
