const upstreamTransformer = require('metro-react-native-babel-transformer');

module.exports.transform = ({ src, filename, options }) =>
  upstreamTransformer.transform({
    src,
    filename,
    options: {
      ...options,
      sourceType: 'unambiguous',
      plugins: [['babel-plugin-transform-import-meta', { module: 'CommonJS' }]],
    },
  });
