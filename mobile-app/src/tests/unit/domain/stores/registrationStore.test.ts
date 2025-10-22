import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  RegistrationData,
  useRegistrationStore,
} from '../../../../domain/stores/registrationStore';

const resetStore = () => {
  useRegistrationStore.setState({
    currentStep: 1,
    data: {
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
    },
  });
};

describe('registrationStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('starts at step 1 with empty data', () => {
    const state = useRegistrationStore.getState();
    expect(state.currentStep).toBe(1);
    expect(state.data).toMatchObject({
      name: '',
      email: '',
      birthDate: null,
      minAge: 18,
      maxAge: 99,
    });
  });

  it('navigates between steps respecting the allowed bounds', () => {
    const { nextStep, previousStep, setCurrentStep } = useRegistrationStore.getState();

    for (let i = 0; i < 10; i += 1) {
      nextStep();
    }
    let state = useRegistrationStore.getState();
    expect(state.currentStep).toBe(7);

    for (let i = 0; i < 10; i += 1) {
      previousStep();
    }
    state = useRegistrationStore.getState();
    expect(state.currentStep).toBe(1);

    setCurrentStep(5);
    state = useRegistrationStore.getState();
    expect(state.currentStep).toBe(5);
  });

  it('updates the registration data partially without losing existing fields', () => {
    const { updateData } = useRegistrationStore.getState();

    const updates: Partial<RegistrationData> = {
      name: 'Alice',
      email: 'alice@example.com',
      birthDate: new Date('1995-05-15T00:00:00.000Z'),
      gender: 'female',
      minAge: 24,
    };

    updateData(updates);

    const state = useRegistrationStore.getState();
    expect(state.data).toMatchObject({
      name: 'Alice',
      email: 'alice@example.com',
      gender: 'female',
      minAge: 24,
      maxAge: 99,
    });
    expect(state.data.birthDate).toEqual(new Date('1995-05-15T00:00:00.000Z'));
  });

  it('resets the wizard with resetRegistration', () => {
    const { updateData, resetRegistration } = useRegistrationStore.getState();

    updateData({
      name: 'Alice',
      country: 'Spain',
    });
    resetRegistration();

    const state = useRegistrationStore.getState();
    expect(state.currentStep).toBe(1);
    expect(state.data).toMatchObject({
      name: '',
      country: '',
      avatarUrl: null,
    });
  });
});

