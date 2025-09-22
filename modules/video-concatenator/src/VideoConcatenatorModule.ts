import { NativeModulesProxy } from 'expo-modules-core';
import VideoConcatenatorModule from './VideoConcatenatorModule.native';

export default NativeModulesProxy.VideoConcatenatorModule || VideoConcatenatorModule;