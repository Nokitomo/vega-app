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
export function getHomeHeroLayout(
  width: number,
  height: number,
  fontScale = 1,
  topInset = 0,
) {
  const tablet = Math.min(width, height) >= 600;
  const landscape = tablet && width > height;
  const scale = Math.max(1, fontScale);
  const logoHeight = tablet ? 100 : 80;
  const minHeight = tablet
    ? Math.min(760, Math.max(460, height * 0.72))
    : Math.min(680, Math.max(520, height * 0.68));
  // Reserve the worst supported text layout, independently of the current post:
  // title (3 lines), genres (1), synopsis (3), error (2), CTA (2).
  // Extra space is artwork, rather than a minimum spacer that grows the card.
  const contentBudget = Math.max(logoHeight, 34 * 3 * scale) +
    18 * scale + 20 * 3 * scale + 22 * 2 * scale +
    Math.max(48, 24 * 2 * scale + 20) + 5 * 12 + 12 + 16 + 12;
  const frameHeight = Math.ceil(Math.max(
    tablet ? minHeight : width * 1.5,
    topInset + 56 + 32 + contentBudget,
  ));
  return {
    tablet,
    landscape,
    inset: tablet ? 32 : 16,
    minHeight,
    frameHeight,
    contentBudget,
    spacer: landscape ? 80 : Math.min(tablet ? 400 : 290, width * 0.65),
    contentWidth: tablet
      ? Math.min(560, width * (landscape ? 0.48 : 0.75))
      : width,
    logoHeight,
    indicatorTargetWidth: Math.min(48, (width - (tablet ? 64 : 32)) / 6),
    indicatorWidth: Math.min(48, (width - (tablet ? 64 : 32)) / 6) - 8,
  };
}
