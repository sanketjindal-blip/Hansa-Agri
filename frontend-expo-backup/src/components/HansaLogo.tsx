import React from 'react';
import { Image, ImageStyle } from 'react-native';

export function HansaLogo({ size = 72, style }: { size?: number; style?: ImageStyle }) {
  return (
    <Image
      source={require('../../assets/images/hansa-logo.jpeg')}
      style={[{ width: size, height: size, borderRadius: size / 8, resizeMode: 'contain' }, style as any]}
    />
  );
}
