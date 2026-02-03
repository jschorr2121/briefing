/**
 * Capacitor native bridge utilities.
 * Handles platform detection and native plugin initialization.
 * Safe to import on web — all calls are no-ops when not running in Capacitor.
 */

import { Capacitor } from '@capacitor/core';

/** Whether the app is running inside a native Capacitor shell */
export const isNative = Capacitor.isNativePlatform();

/** Current platform: 'ios' | 'android' | 'web' */
export const platform = Capacitor.getPlatform();

/**
 * Initialize native plugins when running in Capacitor.
 * Call this once from the root layout/provider.
 */
export async function initNativePlugins(): Promise<void> {
  if (!isNative) return;

  try {
    // Status bar — dark content on dark background
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0a0a0a' });
  } catch (e) {
    console.warn('[Capacitor] StatusBar plugin error:', e);
  }

  try {
    // Splash screen — hide after app renders
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch (e) {
    console.warn('[Capacitor] SplashScreen plugin error:', e);
  }

  try {
    // Keyboard — handle resize behavior on iOS
    const { Keyboard } = await import('@capacitor/keyboard');
    if (platform === 'ios') {
      await Keyboard.setScroll({ isDisabled: false });
    }
  } catch (e) {
    console.warn('[Capacitor] Keyboard plugin error:', e);
  }

  try {
    // App — handle back button on Android, app state changes
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      }
    });
  } catch (e) {
    console.warn('[Capacitor] App plugin error:', e);
  }
}

/**
 * Request push notification permissions and register.
 * Returns the device token if successful, null otherwise.
 */
export async function registerPushNotifications(): Promise<string | null> {
  if (!isNative) return null;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.log('[Push] Permission not granted');
      return null;
    }

    // Register with APNs/FCM
    await PushNotifications.register();

    // Wait for registration token
    return new Promise((resolve) => {
      PushNotifications.addListener('registration', (token) => {
        console.log('[Push] Registered with token:', token.value);
        resolve(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] Registration error:', error);
        resolve(null);
      });

      // Timeout after 10 seconds
      setTimeout(() => resolve(null), 10000);
    });
  } catch (e) {
    console.error('[Push] Error:', e);
    return null;
  }
}

/**
 * Trigger a light haptic feedback (for button presses, etc.)
 */
export async function hapticLight(): Promise<void> {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {
    // Silently fail — haptics are a nice-to-have
  }
}

/**
 * Trigger a medium haptic feedback (for important actions)
 */
export async function hapticMedium(): Promise<void> {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (e) {
    // Silently fail
  }
}
