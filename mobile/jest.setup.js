// Native modules that don't exist in the Jest (Node) environment -- mocked
// with their official test doubles so component tests can render screens
// that touch persisted preferences (theme, units, etc.) without a device.
jest.mock('@react-native-async-storage/async-storage', () => {
  const mock = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
  return { __esModule: true, default: mock };
});
