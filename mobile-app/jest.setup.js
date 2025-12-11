// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock Expo modules
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        apiUrl: 'http://localhost:3000/api/v1',
      },
    },
  },
}));

// Mock Expo Router primitives for tests
jest.mock('expo-router', () => {
  const React = require('react');
  const createStub = () => {
    const Component = ({ children }) => React.createElement(React.Fragment, null, children);
    Component.Screen = ({ children }) => React.createElement(React.Fragment, null, children);
    return Component;
  };

  return {
    Link: ({ children }) => React.createElement(React.Fragment, null, children),
    Redirect: () => null,
    Stack: createStub(),
    Tabs: createStub(),
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    }),
    useLocalSearchParams: jest.fn(() => ({})),
  };
});
