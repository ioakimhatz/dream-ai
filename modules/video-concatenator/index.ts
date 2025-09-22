// Reexport the native module. On web, it will be resolved to VideoConcatenatorModule.web.ts
// and on native platforms to VideoConcatenatorModule.ts
export { default } from './src/VideoConcatenatorModule';
export { default as VideoConcatenatorView } from './src/VideoConcatenatorView';
export * from  './src/VideoConcatenator.types';
