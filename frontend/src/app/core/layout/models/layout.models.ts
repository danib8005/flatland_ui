export type LayoutZone =
  | 'left'
  | 'center'
  | 'right'
  | 'bottom'
  | 'floating';

export type PanelSizeMode =
  | 'auto'
  | 'fixed'
  | 'fill';

export interface PanelCapabilities {
  collapsible: boolean;
  movable: boolean;
  resizable: boolean;
  closable: boolean;
  configurable: boolean;
}

export interface PanelDefinition {
  type: string;
  title: string;
  description?: string;
  icon?: string;
  defaultZone: LayoutZone;
  defaultHeight?: number;
  defaultWidth?: number;
  capabilities: PanelCapabilities;
}

export interface PanelInstance {
  id: string;
  type: string;
  title: string;
  zone: LayoutZone;
  order: number;
  collapsed: boolean;
  hidden: boolean;
  height?: number;
  width?: number;
  sizeMode: PanelSizeMode;
  config?: Record<string, unknown>;
}

export interface LayoutColumn {
  zone: LayoutZone;
  width: number | string;
  minWidth?: number;
  maxWidth?: number;
  resizable: boolean;
}

export interface LayoutState {
  version: number;
  columns: LayoutColumn[];
  panels: PanelInstance[];
  selectedPanelId?: string;
}

export const DEFAULT_PANEL_CAPABILITIES: PanelCapabilities = {
  collapsible: true,
  movable: true,
  resizable: false,
  closable: false,
  configurable: false,
};

export function createDefaultLayoutState(): LayoutState {
  return {
    version: 1,
    columns: [
      {
        zone: 'left',
        width: 320,
        minWidth: 240,
        maxWidth: 480,
        resizable: true,
      },
      {
        zone: 'center',
        width: '1fr',
        minWidth: 320,
        resizable: false,
      },
      {
        zone: 'right',
        width: 320,
        minWidth: 240,
        maxWidth: 480,
        resizable: true,
      },
    ],
    panels: [],
  };
}
