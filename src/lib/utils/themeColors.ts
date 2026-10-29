import colors from '../themeColors.json';

export const DEFAULT_PRIMARY = colors.defaultPrimary;
export const LEGACY_PRIMARY = colors.legacyPrimary;

// Preserve the selected accent; adapt only the foreground of filled controls.
export function foregroundOnPrimary(color: string): 'black' | 'white' {
  const hex = color.replace(/^#/, '');
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) {return 'black';}
  const channels = [0, 2, 4].map(offset => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? 'black' : 'white';
}
