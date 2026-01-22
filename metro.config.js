// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// extend assetExts so .svg files are loaded as raw text
config.resolver.assetExts.push('svg');

config.transformer.minifierConfig = {
  keep_classnames: true,
  keep_fnames: true,
  mangle: false,
};

module.exports = config;
