// Keep these dimensions aligned with the loading row in Slider.
const CARD_WIDTH = 112;
const CARD_HORIZONTAL_MARGIN = 12; // mx-3
const ROW_GAP = 8; // gap-2
const CARD_STRIDE = CARD_WIDTH + CARD_HORIZONTAL_MARGIN * 2 + ROW_GAP;

export const getSkeletonPlaceholderCount = (windowWidth: number): number => {
  const width = Number.isFinite(windowWidth) ? Math.max(0, windowWidth) : 0;
  // One extra card covers the clipped edge during resizing or rotation.
  return Math.ceil((width + ROW_GAP) / CARD_STRIDE) + 1;
};
