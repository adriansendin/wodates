const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

config.transformer.babelTransformerPath = require.resolve('./metro.transformer.js');
module.exports = config;
