export const HOME_NAVIGATION_COLOR = '#23252B';

type RouteState = {index?: number; routes: readonly {name: string; state?: RouteState}[]};

// Match the active tab and screen; inactive stacks must not affect the inset.
export const hasAppBottomBar = (state?: RouteState): boolean => {
  const root = state?.routes[state.index ?? 0];
  if (root?.name !== 'TabStack') {return false;}
  const tab = root.state?.routes[root.state.index ?? 0];
  if (!tab) {return true;} // TabStack's initial route is HomeStack.
  if (!['HomeStack', 'SearchStack', 'WatchListStack', 'SettingsStack'].includes(tab.name)) {return false;}
  const screen = tab.state?.routes[tab.state.index ?? 0];
  return !(['HomeStack', 'SearchStack'].includes(tab.name) && screen?.name === 'Webview');
};
