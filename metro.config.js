const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force Metro to prefer CommonJS files over ESM on Web to avoid import.meta issues in dependencies like zustand
// This setting affects the 'exports' field in package.json
// By putting 'require' before 'import', we ensure CJS is picked up even if ESM is available
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

module.exports = config;
