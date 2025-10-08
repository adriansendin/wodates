const path = require('path');
const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  config.module = config.module || {};
  config.module.rules = config.module.rules || [];

  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    zustand: path.join(__dirname, 'node_modules/zustand/index.js'),
  };

  config.module.rules.push({
    test: /\.m?js$/,
    include: [
      path.join(__dirname, 'node_modules/@supabase'),
      path.join(__dirname, 'node_modules/@tanstack'),
    ],
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['babel-preset-expo'],
        plugins: [['babel-plugin-transform-import-meta', { module: 'CommonJS' }]],
      },
    },
  });

  return config;
};
