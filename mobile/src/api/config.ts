import Constants from 'expo-constants';
import { Platform } from 'react-native';

// The FastAPI backend (app/toci) isn't bundled into the mobile app -- it runs
// separately (see app/README.md) and this points at it. Override via
// EXPO_PUBLIC_API_URL (e.g. in mobile/.env.local) with your machine's LAN IP
// when testing on a physical device in Expo Go, since "localhost" there means
// the phone itself, not your dev machine.
function inferDevHost(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as any).expoGoConfig?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return host;
  }
  if (Platform.OS === 'android') return '10.0.2.2'; // Android emulator loopback to host machine
  return 'localhost';
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || `http://${inferDevHost()}:8000`;
