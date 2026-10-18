/**
 * SvastraLogo — Official Brand Mark
 * Stylized 'S' ribbon integrating ambient sun and wearable biometric sensor.
 */
import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

const SVASTRA_LOGO = require('../../assets/svastra-logo.png');

export interface SvastraLogoProps {
  size?: number;
  color?: string; // Maintained for caller API compatibility
  style?: StyleProp<ImageStyle>;
}

export function SvastraLogo({ size = 24, style }: SvastraLogoProps) {
  return (
    <Image
      source={SVASTRA_LOGO}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}

// Retain alias for existing codebase imports
export const NexoraLogo = SvastraLogo;
export default SvastraLogo;
