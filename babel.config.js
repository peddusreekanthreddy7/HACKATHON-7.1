module.exports = function (api) {
  // Cache by env so the test vs build plugin sets don't collide.
  const isTest = api.env('test');

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      // react-native-worklets-core powers vision-camera frame processors. It
      // must be LAST. Skipped under Jest, where our 'worklet'-tagged functions
      // run directly on the JS thread (the directive is just a no-op string).
      ...(isTest ? [] : ['react-native-worklets-core/plugin']),
    ],
  };
};
