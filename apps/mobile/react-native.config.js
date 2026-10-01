module.exports = {
  dependencies: {
    // Android already has a single FCM service in expo-callkit-telecom that forwards
    // ordinary notifications to Expo. A second service would compete for call pushes.
    '@react-native-firebase/app': { platforms: { android: null } },
    '@react-native-firebase/messaging': { platforms: { android: null } },
    // Aliased to @livekit/react-native-webrtc in the root package.json "overrides"
    // (npm installs the alias as a separate physical copy, not a symlink, so
    // autolinking would otherwise register the native module twice and the
    // Android build fails with a duplicate-class dex merge error).
    'react-native-webrtc': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
