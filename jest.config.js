// if there are dependencies that need to be transpiled, add them to this array
const transformDependecies = [
  'react-redux',
  '@babel\\runtime',
  '@babel/runtime',
  'lodash-es',
].join('|');

const config = {
  roots: ['<rootDir>/src'],
  testPathIgnorePatterns: ['<rootDir>/(node_modules|build|dist|docs|config|typings)/'],
  testTimeout: 15000,
  testEnvironment: 'jsdom',
  transformIgnorePatterns: [`node_modules/(?!(${transformDependecies})/)`],
};
module.exports = config;
