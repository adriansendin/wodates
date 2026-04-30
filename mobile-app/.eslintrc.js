module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier'
  ],
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'prettier'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    },
    project: './tsconfig.json'
  },
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    // Warn about direct Alert.alert usage - prefer notificationService
    // Note: Alert.alert is still allowed for option selection and success messages
    'no-restricted-imports': [
      'warn',
      {
        paths: [
          {
            name: 'react-native',
            importNames: ['Alert'],
            message:
              'Avoid direct Alert.alert() for errors. Use notifyActionable() or notifySystem() from notificationService instead. Alert.alert() is still allowed for option selection and success messages.'
          }
        ]
      }
    ]
  },
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  overrides: [
    {
      // Disable Alert import restriction for centralized notification system files
      files: [
        'src/utils/notificationService.ts',
        'src/utils/showAlert.ts',
        'src/utils/notify.ts',
        'src/utils/crossPlatformAlert.ts'
      ],
      rules: {
        'no-restricted-imports': 'off'
      }
    }
  ]
};
