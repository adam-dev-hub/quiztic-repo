// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro configuration for Expo projects
 * @type {import('expo/metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

// ✅ extend assetExts so .svg files are loaded as raw text
config.resolver.assetExts.push('svg');

// ✅ keep your custom minifier settings
config.transformer.minifierConfig = {
  keep_classnames: true,
  keep_fnames: true,
  mangle: false,
};

module.exports = config;
