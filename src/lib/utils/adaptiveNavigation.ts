export function isTabletScreen(screenWidth: number, screenHeight: number) {
  return Math.min(screenWidth, screenHeight) >= 600;
}

// Device classification must not change when the keyboard shrinks the window.
// All orientations use bottom tabs; tablet items occupy a centered group.
export function getAdaptiveNavigation(
  windowWidth: number,
  screenWidth: number,
  screenHeight: number,
  fontScale = 1,
) {
  const isTabletDevice = isTabletScreen(screenWidth, screenHeight);
  return {
    isTabletDevice,
    useSideTabLayout: false,
    tabBarHorizontalPadding: isTabletDevice ? Math.max(0, (windowWidth - 400 * Math.max(1, Math.min(fontScale, 1.5))) / 2) : 0,
  };
}
