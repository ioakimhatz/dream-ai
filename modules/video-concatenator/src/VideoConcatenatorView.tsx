import { requireNativeView } from 'expo';
import * as React from 'react';

import { VideoConcatenatorViewProps } from './VideoConcatenator.types';

const NativeView: React.ComponentType<VideoConcatenatorViewProps> =
  requireNativeView('VideoConcatenator');

export default function VideoConcatenatorView(props: VideoConcatenatorViewProps) {
  return <NativeView {...props} />;
}
