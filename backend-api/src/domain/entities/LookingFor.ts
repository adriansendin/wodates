export const LOOKING_FOR_VALUES = ['male', 'female', 'both'] as const;

export type LookingForValue = (typeof LOOKING_FOR_VALUES)[number];
