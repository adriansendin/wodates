const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configuración para evitar problemas con reanimated en Expo Go
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;
