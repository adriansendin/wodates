import { create } from 'zustand';
import { GenderOption } from '../entities/Gender';
import { LookingForOption } from '../entities/LookingFor';

export interface RegistrationData {
  name: string;
  email: string;
  password: string;
  birthDate: Date | null;
  location: string;
  country: string;
  gender: GenderOption | '';
  lookingFor: LookingForOption | '';
  minAge: number;
  maxAge: number;
  avatarUrl: string | null;
  // Plan familiar
  hasChildren: boolean | null;
  wantsChildren: 'yes' | 'no' | 'not_sure' | null;
  caresAboutPartnerChildren: 'yes' | 'no' | null;
  // Hábitos importantes
  smoking: 'no' | 'occasionally' | 'regularly' | null;
  caresAboutPartnerSmoking: 'yes' | 'no' | null;
}

interface RegistrationState {
  currentStep: number;
  data: RegistrationData;
}

interface RegistrationActions {
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  updateData: (updates: Partial<RegistrationData>) => void;
  resetRegistration: () => void;
}

const initialData: RegistrationData = {
  name: '',
  email: '',
  password: '',
  birthDate: null,
  location: '',
  country: '',
  gender: '',
  lookingFor: '',
  minAge: 18,
  maxAge: 99,
  avatarUrl: null,
  // Plan familiar
  hasChildren: null,
  wantsChildren: null,
  caresAboutPartnerChildren: null,
  // Hábitos importantes
  smoking: null,
  caresAboutPartnerSmoking: null,
};

export const useRegistrationStore = create<
  RegistrationState & RegistrationActions
>((set) => ({
  // State
  currentStep: 1,
  data: initialData,

  // Actions
  setCurrentStep: (step) => set({ currentStep: step }),

  nextStep: () =>
    set((state) => ({
      currentStep: Math.min(state.currentStep + 1, 7),
    })),

  previousStep: () =>
    set((state) => ({
      currentStep: Math.max(state.currentStep - 1, 1),
    })),

  updateData: (updates) =>
    set((state) => ({
      data: { ...state.data, ...updates },
    })),

  resetRegistration: () =>
    set({
      currentStep: 1,
      data: initialData,
    }),
}));
