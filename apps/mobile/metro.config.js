const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// `react-native-webrtc` is npm-aliased to `@livekit/react-native-webrtc` in the
// root package.json "overrides", but npm installs that alias as a separate
// physical copy rather than a symlink. Without this, Metro bundles both
// node_modules/react-native-webrtc and node_modules/@livekit/react-native-webrtc
// as distinct module instances (e.g. @telnyx/react-native-voice-sdk imports the
// former, app code imports the latter), and each one independently calls
// requireNativeComponent('RTCVideoView') at load time, which throws
// "Tried to register two views with the same name RTCVideoView". Force both
// specifiers to resolve to the same module instance.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-webrtc' || moduleName.startsWith('react-native-webrtc/')) {
    const redirected = moduleName.replace('react-native-webrtc', '@livekit/react-native-webrtc');
    return (defaultResolveRequest ?? context.resolveRequest)(context, redirected, platform);
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: './src/global.css',
});
