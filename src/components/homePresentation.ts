export const HOME_FONT = {
  heading: 'VegaAtypBold',
  regular: 'VegaDMSansRegular',
  medium: 'VegaDMSansMedium',
  bold: 'VegaDMSansBold',
};
// Shared by Home catalog cards and search results; artwork selection stays separate.
export const CATALOG_CARD_TITLE_STYLE = {
  fontFamily: HOME_FONT.regular,
  fontSize: 14,
  lineHeight: 19,
  textAlign: 'left' as const,
  marginTop: 8,
  minHeight: 57,
};

export const getHomeCardWidth = (windowWidth: number) =>
  windowWidth >= 600
    ? 146
    : Math.min(154, Math.max(1, windowWidth) * 0.37);

// Tablet artwork follows the available width, not the tall portrait viewport.
// Measured content can expand every slide together for accessibility/errors.
export function getHomeHeroLayout(
  width: number,
  height: number,
  fontScale = 1,
  topInset = 0,
  measuredContentHeight = 0,
) {
  const tablet = Math.min(width, height) >= 600;
  const landscape = tablet && width > height;
  const scale = Math.max(1, fontScale);
  const logoHeight = 80;
  const minHeight = tablet
    ? Math.min(720, Math.max(360, width * 0.5))
    : Math.min(680, Math.max(520, height * 0.68));
  // Phone: reserve the worst supported text layout, independently of the post:
  // title (3 lines), genres (1), synopsis (3), error (2), CTA (2).
  // Extra space is artwork, rather than a minimum spacer that grows the card.
  const contentBudget = Math.max(logoHeight, 34 * 3 * scale) +
    18 * scale + 20 * 3 * scale + 22 * 2 * scale +
    Math.max(48, 24 * 2 * scale + 20) + 5 * 12 + 12 + 16 + 12;
  const frameHeight = Math.ceil(Math.max(
    tablet ? minHeight : width * 1.5,
    tablet
      ? topInset + 56 + 16 + measuredContentHeight
      : topInset + 56 + 32 + contentBudget,
  ));
  return {
    tablet,
    landscape,
    inset: tablet ? 24 : 16,
    minHeight,
    frameHeight,
    contentBudget,
    spacer: landscape ? 80 : Math.min(tablet ? 400 : 290, width * 0.65),
    contentWidth: tablet
      ? width * 0.5
      : width,
    logoHeight,
    indicatorTargetWidth: Math.min(48, (width - (tablet ? 48 : 32)) / 6),
    indicatorWidth: Math.min(48, (width - (tablet ? 48 : 32)) / 6) - 8,
  };
}
