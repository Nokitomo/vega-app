type HomeSection = {
  filter: string;
  title: string;
  titleKey?: string;
  titleParams?: Record<string, string | number>;
  Posts: readonly unknown[];
  isLoading?: boolean;
  error?: string;
};

/** Keep unchanged section identities so list rows can skip rendering. */
export const reconcileHomeSections = <T extends HomeSection>(
  previous: {scope: string; data: T[]} | null,
  scope: string,
  next: T[],
): T[] => {
  if (!previous || previous.scope !== scope || previous.data.length !== next.length) {
    return next;
  }

  let changed = false;
  const sections = next.map((section, index) => {
    const old = previous.data[index];
    if (
      old.filter === section.filter &&
      old.title === section.title &&
      old.titleKey === section.titleKey &&
      old.titleParams === section.titleParams &&
      old.Posts === section.Posts &&
      old.isLoading === section.isLoading &&
      old.error === section.error
    ) {
      return old;
    }
    changed = true;
    return section;
  });

  return changed ? sections : previous.data;
};
