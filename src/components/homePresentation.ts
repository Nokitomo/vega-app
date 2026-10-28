export const HOME_ACCENT = '#FF640A';
export const HOME_FONT = {
  heading: 'VegaAtypBold',
  regular: 'VegaDMSansRegular',
  medium: 'VegaDMSansMedium',
  bold: 'VegaDMSansBold',
};
export const getHomeCardWidth = (windowWidth: number) =>
  windowWidth >= 600
    ? Math.min(200, Math.max(160, windowWidth * 0.19))
    : Math.min(154, Math.max(1, windowWidth) * 0.37);

// Keep artwork and readable content bounded in both tablet orientations.
export function getHomeHeroLayout(width: number, height: number) {
  const tablet = Math.min(width, height) >= 600;
  const landscape = tablet && width > height;
  return {
    tablet,
    landscape,
    inset: tablet ? 32 : 16,
    minHeight: tablet
      ? Math.min(760, Math.max(460, height * 0.72))
      : Math.min(680, Math.max(520, height * 0.68)),
    spacer: landscape ? 80 : Math.min(tablet ? 400 : 290, width * 0.65),
    contentWidth: tablet
      ? Math.min(560, width * (landscape ? 0.48 : 0.75))
      : width,
    logoHeight: tablet ? 100 : 78,
    indicatorWidth: Math.max(24, Math.min(39, (width - 32 - 5 * 8) / 6)),
  };
}
