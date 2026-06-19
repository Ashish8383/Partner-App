import { useMemo } from 'react';
import { PixelRatio, useWindowDimensions, Dimensions } from 'react-native';

const BASE_W = 375;

const buildHelpers = (w, h) => {
  const isTablet = w >= 768;
  const isLandscape = w > h;
  const sc = w / BASE_W;

  const NZ_MAX = isTablet ? 1.18 : 1.35;
  const RS_MAX = isTablet ? 1.15 : 1.25;

  // nz - for font sizes and icons (non-linear scaling)
  const nz = (size) =>
    Math.round(PixelRatio.roundToNearestPixel(size * Math.min(sc, NZ_MAX)));

  // rs - for spacing, paddings, margins, borders (regular scaling)
  const rs = (size) => Math.round(size * Math.min(sc, RS_MAX));

  // Grid columns based on device and orientation
  const cols = isTablet && isLandscape ? 3 : 2;

  // Helper for percentages
  const wp = (percent) => (w * percent) / 100;
  const hp = (percent) => (h * percent) / 100;

  return {
    nz,
    rs,
    SW: w,
    SH: h,
    isTablet,
    isLandscape,
    cols,
    sc,
    wp,
    hp
  };
};

// Hook for components (updates on orientation change)
export const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  return useMemo(() => buildHelpers(width, height), [width, height]);
};

// Static exports for non-component files
const { width: _w0, height: _h0 } = Dimensions.get('window');
const _static = buildHelpers(_w0, _h0);

export const nz = _static.nz;
export const rs = _static.rs;
export const isTablet = _static.isTablet;
export const isLandscape = _static.isLandscape;
export const deviceInfo = {
  isTablet: _static.isTablet,
  screenWidth: _w0,
  screenHeight: _h0,
  scaleFactor: _static.sc,
};

// Convenience exports
export const wp = _static.wp;
export const hp = _static.hp;
export const SW = _static.SW;
export const SH = _static.SH;