import type {
  LorebookEntrySnapshot,
  LorebookTimelineContext,
  LorebookVersionMode,
  ResolvedLorebookViewState
} from '../../types/LorebookViewTypes';

const formatSnapshotLabel = (snapshot: LorebookEntrySnapshot): string => {
  const timeText = new Date(snapshot.capturedAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  const nodeSuffix = snapshot.activeLeafId ? snapshot.activeLeafId.slice(-6) : 'root';
  const sourceText = snapshot.sourceId === 'forge' ? 'Forge' : 'Chat';
  return `${sourceText} · ${nodeSuffix} · ${timeText}`;
};

export class LorebookTimelineResolver {
  static createSnapshotKey(context: LorebookTimelineContext): string | null {
    if (!context.bookId) return null;
    return [
      context.bookId,
      context.sourceId || 'chat',
      context.sessionId || 'default',
      context.activeLeafId || 'root'
    ].join('::');
  }

  static createSnapshotLabel(context: LorebookTimelineContext): string {
    const sourceText = context.sourceId === 'forge' ? 'Forge' : 'Chat';
    const nodeSuffix = context.activeLeafId ? context.activeLeafId.slice(-6) : 'root';
    return `${sourceText} · ${nodeSuffix}`;
  }

  static resolve(params: {
    mode: LorebookVersionMode;
    context: LorebookTimelineContext;
    liveEntries: LuminaLorebookEntry[];
    snapshots: LorebookEntrySnapshot[];
    pinnedSnapshotKey?: string | null;
    manualSnapshotKey?: string | null;
  }): ResolvedLorebookViewState {
    const {
      mode,
      context,
      liveEntries,
      snapshots,
      pinnedSnapshotKey = null,
      manualSnapshotKey = null
    } = params;

    const currentSnapshotKey = this.createSnapshotKey(context);
    const snapshotMap = new Map(snapshots.map(snapshot => [snapshot.key, snapshot]));
    const followSnapshot = currentSnapshotKey ? snapshotMap.get(currentSnapshotKey) ?? null : null;
    const pinnedSnapshot = pinnedSnapshotKey ? snapshotMap.get(pinnedSnapshotKey) ?? null : null;
    const manualSnapshot = manualSnapshotKey ? snapshotMap.get(manualSnapshotKey) ?? null : null;

    if (mode === 'pinned' && pinnedSnapshot) {
      return {
        mode,
        snapshotKey: pinnedSnapshot.key,
        versionLabel: formatSnapshotLabel(pinnedSnapshot),
        versionHint: '当前视图已固定，不会随时间线跳转自动变化。',
        entries: pinnedSnapshot.entries
      };
    }

    if (mode === 'manual' && manualSnapshot) {
      return {
        mode,
        snapshotKey: manualSnapshot.key,
        versionLabel: formatSnapshotLabel(manualSnapshot),
        versionHint: '当前视图正在查看手动选择的历史版本。',
        entries: manualSnapshot.entries
      };
    }

    if (followSnapshot) {
      return {
        mode: 'follow-timeline',
        snapshotKey: followSnapshot.key,
        versionLabel: formatSnapshotLabel(followSnapshot),
        versionHint: '当前内容跟随时间线节点回溯。',
        entries: followSnapshot.entries
      };
    }

    return {
      mode: 'follow-timeline',
      snapshotKey: currentSnapshotKey,
      versionLabel: this.createSnapshotLabel(context),
      versionHint: '当前节点暂无已记录快照，正在显示当前世界书内容。',
      entries: liveEntries
    };
  }
}
