/** Reset the main workspace scroll position (e.g. after switching documents). */
export function resetWorkspaceScroll(container: HTMLElement): void {
  container.scrollTop = 0;
  container.scrollLeft = 0;
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/** Reset scroll after layout updates (async content, editor mount, etc.). */
export function scheduleWorkspaceScrollReset(container: HTMLElement): void {
  resetWorkspaceScroll(container);
  requestAnimationFrame(() => {
    resetWorkspaceScroll(container);
  });
}
