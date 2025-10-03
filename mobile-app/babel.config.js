module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Solo incluir reanimated si no estamos en Expo Go
      ...(process.env.EXPO_PUBLIC_USE_EXPO_GO !== 'false' ? [] : ['react-native-reanimated/plugin']),
    ],
  };
};
