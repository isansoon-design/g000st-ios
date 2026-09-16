// Web Configuration for Capacitor
// This file manages the backend API endpoints and app configuration for web, iOS, and Android

export const APP_CONFIG = {
  // App Identifier
  appId: 'com.g000st.app',
  appName: 'g000st',
  version: '1.0.0',

  // Backend API Configuration
  // Use environment variables to switch between environments
  api: {
    // Local development
    development: {
      baseUrl: 'http://localhost:3001',
      chatUrl: 'http://localhost:3002',
      appUrl: 'http://localhost:3003',
      timeout: 30000,
    },
    // Staging
    staging: {
      baseUrl: 'https://api-staging.g000st.com',
      chatUrl: 'https://chat-staging.g000st.com',
      appUrl: 'https://app-staging.g000st.com',
      timeout: 30000,
    },
    // Production
    production: {
      baseUrl: 'https://api.g000st.com',
      chatUrl: 'https://chat.g000st.com',
      appUrl: 'https://app.g000st.com',
      timeout: 30000,
    },
  },

  // Firebase Configuration
  firebase: {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyD...',
    authDomain: 'g000st.firebaseapp.com',
    projectId: 'g000st-project',
    storageBucket: 'g000st-project.appspot.com',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:abc123def456',
  },

  // Feature Flags
  features: {
    enableChat: true,
    enableSocial: true,
    enableMobileOptimization: true,
    enablePushNotifications: true,
    enableBiometric: true, // Face ID / Fingerprint
  },

  // Default Values
  defaults: {
    language: 'ar', // Arabic by default
    currency: 'SAR', // Saudi Riyal
    timezone: 'Asia/Riyadh',
  },

  // Permissions
  permissions: {
    ios: [
      'NSCameraUsageDescription',
      'NSMicrophoneUsageDescription',
      'NSLocationWhenInUseUsageDescription',
    ],
    android: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.INTERNET',
    ],
  },
};

// Helper to get current environment config
export const getApiConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return APP_CONFIG.api[env] || APP_CONFIG.api.development;
};

export default APP_CONFIG;
