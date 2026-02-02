import React from 'react';
import logoSquare from '../assets/resources/OMNISUITE_LOGO_SQUARE.png';

export default function OmniSuiteLogo({ size = 36 }) {
  return (
    <img
      src={logoSquare}
      alt="OmniSuite"
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}
