import { server } from './src/test-utils/server';

beforeAll(() => {
  try {
    server.listen({ onUnhandledRequest: 'error' });
  } catch {
    // MSW setup may fail in some test environments where native modules aren't available
  }
});
afterEach(() => {
  try {
    server.resetHandlers();
  } catch {
    // ignore
  }
});
afterAll(() => {
  try {
    server.close();
  } catch {
    // ignore
  }
});
