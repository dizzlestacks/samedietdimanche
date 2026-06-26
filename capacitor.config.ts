import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor configuration for the YARDEES iOS app.
//
// Approach: hybrid web wrapper that loads www.yardees.net (server.url).
// Benefits: zero rebuild for content/UI changes — push to Railway and the
// iOS app reflects updates instantly. Apple accepts this provided the app
// has a real native shell, native splash, status bar config, and uses
// native plugins for camera, push, haptics (which we do).
//
// To switch to a fully bundled app later (no remote URL), remove `server`
// and add a `webDir: 'dist/public'` after running `npm run build`.

const config: CapacitorConfig = {
  appId: 'com.yardees.app',
  appName: 'YARDEES',
  webDir: 'dist/public',
  bundledWebRuntime: false,
  server: {
    url: 'https://www.yardees.net',
    cleartext: false,
    // Keep navigation strictly to our own domain. Third-party flows
    // (Stripe Checkout, OAuth) should open in the system browser via
    // the Capacitor Browser plugin so untrusted content never runs in
    // the main WebView context. App Store reviewers also prefer this.
    allowNavigation: ['yardees.net', '*.yardees.net'],
  },
  ios: {
    // Use system content inset so the WebView doesn't sit behind the notch / Dynamic Island.
    contentInset: 'automatic',
    // Background while content loads — matches site cream
    backgroundColor: '#f4f1ea',
    scheme: 'YARDEES',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#1e8f31',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1e8f31',
    },
    Haptics: {},
    App: {},
  },
};

export default config;
