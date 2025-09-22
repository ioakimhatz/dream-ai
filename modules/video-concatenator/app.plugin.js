// Minimal no-op plugin so Expo can load it safely at prebuild time.
// We are NOT importing any TS/ESM or native code here.
module.exports = function withVideoConcatenator(config) {
    return config;
};
