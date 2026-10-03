/**
 * 运行时插件的工作区窗口“休眠”判定（纯函数）。
 *
 * 运行时插件在宿主就绪之后才注册，而启动期的 reconcile 在它们注册之前就会执行：
 * 如果按“应用目录里没有就删除”处理，用户上次留下的运行时插件窗口会被永久删掉。
 * 因此 plugin: / widget: / panel: 开头的失效记录改为保留，不渲染、不计入窗口数；
 * 删除只发生在“插件消失”事件（closeDisappearedApps）或用户主动关闭窗口时。
 *
 * 已知取舍（本次不处理）：从未再次注册的运行时插件（例如对应 Mod 已被删除）没有“消失”事件，
 * 它的休眠记录会一直留在存储里，直到用户清理存储。
 */
const DORMANT_CAPABLE_PREFIXES = ['plugin:', 'widget:', 'panel:'] as const;

export const isDormantCapableAppId = (appId: string): boolean =>
  DORMANT_CAPABLE_PREFIXES.some((prefix) => appId.startsWith(prefix));

/** reconcile 时是否删除该窗口记录：应用已不在目录中，且不属于可休眠类别。 */
export const shouldDropWorkspaceWindowOnReconcile = (appId: string, validAppIds: ReadonlySet<string>): boolean =>
  !validAppIds.has(appId) && !isDormantCapableAppId(appId);

/** 把舞台上的窗口 id 分为可渲染（应用在目录中）与休眠（记录存在但应用未注册）。不存在的窗口记录被忽略。 */
export const partitionWorkspaceWindowIds = (
  windowIds: readonly string[],
  windows: Readonly<Record<string, { appId: string } | undefined>>,
  validAppIds: ReadonlySet<string>
): { renderable: string[]; dormant: string[] } => {
  const renderable: string[] = [];
  const dormant: string[] = [];
  for (const windowId of windowIds) {
    const window = windows[windowId];
    if (!window) continue;
    (validAppIds.has(window.appId) ? renderable : dormant).push(windowId);
  }
  return { renderable, dormant };
};

/** 插件消失时要关闭的 appId：这些插件可能对应的 plugin:/widget:/panel: 应用中，已不在目录里的那些。 */
export const computeDisappearedAppIds = (ids: readonly string[], validAppIds: ReadonlySet<string>): string[] =>
  ids
    .flatMap((id) => DORMANT_CAPABLE_PREFIXES.map((prefix) => `${prefix}${id}`))
    .filter((appId) => !validAppIds.has(appId));

/**
 * 活动窗口的选择：当前活动窗口存在且其应用已注册则保留；
 * 否则（失效、休眠或为空）回退到舞台上层级最高的可渲染窗口，没有则为 null。
 */
export const resolveActiveWorkspaceWindowId = (
  currentWindowId: string | null,
  stageWindowIds: readonly string[],
  windows: Readonly<Record<string, { appId: string; zIndex: number } | undefined>>,
  validAppIds: ReadonlySet<string>
): string | null => {
  const current = currentWindowId ? windows[currentWindowId] : undefined;
  if (currentWindowId && current && validAppIds.has(current.appId)) return currentWindowId;
  const { renderable } = partitionWorkspaceWindowIds(stageWindowIds, windows, validAppIds);
  let best: string | null = null;
  for (const windowId of renderable) {
    if (best === null || (windows[windowId]?.zIndex ?? 0) > (windows[best]?.zIndex ?? 0)) best = windowId;
  }
  return best;
};

/** 没有任何可渲染窗口时（含只剩休眠窗口）需要播种初始窗口。 */
export const shouldSeedWorkspace = (
  windows: Readonly<Record<string, { appId: string } | undefined>>,
  validAppIds: ReadonlySet<string>
): boolean => !Object.values(windows).some((window) => window && validAppIds.has(window.appId));

/** 应用目录新增 id 之后，哪些窗口刚从休眠中被唤醒（应用此前不在目录、现在在）。 */
export const findAwakenedWindowIds = (
  windows: Readonly<Record<string, { appId: string } | undefined>>,
  previousAppIds: ReadonlySet<string>,
  currentAppIds: ReadonlySet<string>
): string[] =>
  Object.entries(windows)
    .filter(([, window]) => window && currentAppIds.has(window.appId) && !previousAppIds.has(window.appId))
    .map(([windowId]) => windowId);
