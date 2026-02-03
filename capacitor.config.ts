import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.briefing.news',
  appName: 'Briefing',
  webDir: 'out',

  // In production, load from the Vercel deployment
  // Comment out for local development with static export
  server: {
    url: 'https://briefing-five.vercel.app',
    cleartext: false,
  },

  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },

  ios: {
    scheme: 'Briefing',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#0a0a0a',
  },

  android: {
    backgroundColor: '#0a0a0a',
    allowMixedContent: false,
    captureInput: true,
  },
};

export default config;
