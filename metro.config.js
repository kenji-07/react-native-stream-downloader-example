// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// The downloader is installed with file:.. and lives outside the Expo app.
// Resolve its React peers from this app to avoid mixing the package's RN 0.74
// verification dependencies with the app's React 19 / RN 0.86 runtime.
config.watchFolders = [...new Set([...config.watchFolders, path.resolve(__dirname, '..')])];
const previousResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isReactPeer = moduleName === 'react' || moduleName.startsWith('react/') ||
    moduleName === 'react-native' || moduleName.startsWith('react-native/');
  const peerContext = isReactPeer
    ? { ...context, originModulePath: path.join(__dirname, 'package.json') }
    : context;
  return previousResolver
    ? previousResolver(peerContext, moduleName, platform)
    : context.resolveRequest(peerContext, moduleName, platform);
};

module.exports = config;
