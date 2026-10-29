export const HOME_NAVIGATION_COLOR = '#23252B';

type RouteState = {index?: number; routes: readonly {name: string; state?: RouteState}[]};

// Match the visible tab, not an inactive HomeStack retained in navigation state.
export const hasHomeBottomBar = (state?: RouteState): boolean => {
  const root = state?.routes[state.index ?? 0];
  if (root?.name !== 'TabStack') {return false;}
  const tab = root.state?.routes[root.state.index ?? 0];
  if (!tab) {return true;} // TabStack's initial route is HomeStack.
  if (tab.name !== 'HomeStack') {return false;}
  const screen = tab.state?.routes[tab.state.index ?? 0];
  return screen?.name !== 'Webview';
};
