import { Dimensions, PixelRatio } from 'react-native';

const { width: SW } = Dimensions.get('window');
const IS_TAB = SW >= 768;
const sc = SW / 375;

export const nz = (size) => 
  Math.round(PixelRatio.roundToNearestPixel(size * Math.min(sc, IS_TAB ? 1.22 : 1.35)));

export const rs = (size) => 
  Math.round(size * Math.min(sc, IS_TAB ? 1.28 : 1.25));
export const deviceInfo = {
  isTablet: IS_TAB,
  screenWidth: SW,
  scaleFactor: sc
};