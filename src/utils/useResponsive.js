import { useMemo } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';

const BASE_W = 375;

const buildHelpers = (w, h) => {
  const isTablet    = w >= 768;
  const isLandscape = w > h;
  const sc          = w / BASE_W;

  const NZ_MAX = isTablet ? 1.18 : 1.35;
  const RS_MAX = isTablet ? 1.15 : 1.25;
  const nz = (size) =>
    Math.round(PixelRatio.roundToNearestPixel(size * Math.min(sc, NZ_MAX)));
  const rs = (size) => Math.round(size * Math.min(sc, RS_MAX));
  const cols = isTablet && isLandscape ? 3 : 2;

  return { nz, rs, SW: w, SH: h, isTablet, isLandscape, cols, sc };
};

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  return useMemo(() => buildHelpers(width, height), [width, height]);
};

import { Dimensions } from 'react-native';
const { width: _w0, height: _h0 } = Dimensions.get('window');
const _static = buildHelpers(_w0, _h0);

export const nz        = _static.nz;
export const rs        = _static.rs;
export const isTablet  = _static.isTablet;
export const deviceInfo = {
  isTablet:    _static.isTablet,
  screenWidth: _w0,
  scaleFactor: _static.sc,
};