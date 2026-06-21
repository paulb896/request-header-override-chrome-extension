module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  collectCoverageFrom: [
    'src/pages/Popup/**/*.{js,jsx}',
    'utils/**/*.{js,jsx}',
    '!utils/build.js',
    '!utils/webserver.js',
    '!utils/env.js',
    '!utils/index.js',
    '!src/**/*.test.{js,jsx}',
    '!src/pages/Popup/index.jsx'
  ]
};
