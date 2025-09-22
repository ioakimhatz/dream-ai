import * as React from 'react';

import { VideoConcatenatorViewProps } from './VideoConcatenator.types';

export default function VideoConcatenatorView(props: VideoConcatenatorViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
