const preset = require('jest-expo/jest-preset');

// msw (dùng cho mock generated từ @sportspace/shared) kéo theo một chuỗi
// dependency ESM-only (rettime, until-async, outvariant...) không có bản
// CJS. Phải cho babel-jest transpile các package này thay vì bỏ qua như
// node_modules thông thường, và mở rộng transform sang .mjs vì preset gốc
// chỉ khớp .js/.ts/.jsx/.tsx.
const TRANSFORM_ALLOWLIST = [
  '.pnpm',
  '(jest-)?react-native',
  '@react-native(-community)?',
  'expo(nent)?',
  '@expo(nent)?/.*',
  '@expo-google-fonts/.*',
  'react-navigation',
  '@react-navigation/.*',
  '@sentry/react-native',
  'native-base',
  'react-native-svg',
  'msw',
  '@mswjs/.*',
  '@open-draft/.*',
  '@inquirer/.*',
  'is-node-process',
  'outvariant',
  'rettime',
  'strict-event-emitter',
  'until-async',
  'headers-polyfill',
  'cookie',
  'statuses',
  'path-to-regexp',
  'picocolors',
  'tough-cookie',
  'type-fest',
  'graphql',
  'yargs.*',
  'cliui',
  'string-width.*',
  'strip-ansi.*',
  'wrap-ansi.*',
  'ansi-regex.*',
  'emoji-regex',
  'get-caller-file',
  'require-directory',
  'y18n',
  '@faker-js/faker',
];

module.exports = {
  ...preset,
  setupFiles: [...(preset.setupFiles ?? []), './jest.setup.ts'],
  setupFilesAfterEnv: [...(preset.setupFilesAfterEnv ?? []), './jest.setup-after-env.ts'],
  transformIgnorePatterns: [`node_modules/(?!(${TRANSFORM_ALLOWLIST.join('|')}))`],
  transform: {
    ...preset.transform,
    '\\.mjs$': preset.transform['\\.[jt]sx?$'],
  },
};
