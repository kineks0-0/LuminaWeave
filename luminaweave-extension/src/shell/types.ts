import type { Component } from 'vue';
import type { LuminaPlugin } from '../types/plugin';

export interface DynamicTabConfig {
  id: string;
  name: string;
  icon: string;
  component: Component | string;
  props?: Record<string, unknown>;
}

export interface RegisteredPanelConfig {
  title: string;
  icon?: string;
  defaultMode?: 'tab' | 'modal';
}

export interface RegisteredPanelEntry {
  id: string;
  component: Component;
  config: RegisteredPanelConfig;
}

export interface WidgetPanelItem {
  id: string;
  name: string;
  icon: string;
}

export interface WidgetPanelGroup {
  label?: string;
  items: WidgetPanelItem[];
}

export type WidgetPluginEntry = LuminaPlugin;

export interface WorkspaceStageStripItem {
  id: string;
  label: string;
  isActive: boolean;
  isEmpty: boolean;
  windowCount: number;
  appIcons: string[];
  previewTitles: string[];
}

export interface WorkspaceDockItem {
  id: string;
  title: string;
  icon: string;
  isRunning: boolean;
  isActive: boolean;
}

export interface WorkspaceSceneInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface WorkspaceWindowEntry {
  id: string;
  appId: string;
  title: string;
  icon: string;
  component: Component;
  props: Record<string, unknown>;
  kind: 'launcher' | 'main' | 'widget' | 'panel';
  eyebrow: string;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  zIndex: number;
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isCompact: boolean;
}
