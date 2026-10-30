// Device classification must not change when the keyboard shrinks the window.
// A wide content window gets a rail; compact/tablet portrait windows get tabs.
export function getAdaptiveNavigation(
  windowWidth: number,
  screenWidth: number,
  screenHeight: number,
) {
  const isTabletDevice = Math.min(screenWidth, screenHeight) >= 600;
  return {
    isTabletDevice,
    useSideTabLayout: isTabletDevice && windowWidth >= 900,
  };
}
