/**
 * Train types and 4-state colour palette.
 *
 * Two parallel palettes:
 *   - colors:      tinted (alpha 0.7) - intended for fills, dots, labels
 *   - colorsSolid: full opacity         - intended for lines, outlines, agent paths
 *
 * Hex values come from the SBB Flatland UX colour spec; the tinted versions
 * apply alpha 0.7, the solid versions are alpha 1.0 of the same hue.
 *
 * Agents are mapped to train types in round-robin order via AgentColorService,
 * so a deployment with N agents gets at most TRAIN_TYPES.length distinct
 * colour identities. Handles beyond the list wrap modulo.
 */
export type TrainType =
  | 'normal'
  | 'intercity'
  | 'interregio'
  | 'sbahn'
  | 'sbahnWerktag'
  | 'gueterzug';

export type ColorState = 'default' | 'focus' | 'muted' | 'related';

export interface TrainTypeColors {
  default: string;
  focus: string;
  muted: string;
  related: string;
}

interface TrainTypeEntry {
  type: TrainType;
  label: string;
  /** Tinted (alpha 0.7) - dots, badges, fills. */
  colors: TrainTypeColors;
  /** Full opacity - lines, strokes, agent paths. */
  colorsSolid: TrainTypeColors;
}

/**
 * Palette in display order. AgentColorService iterates this list modulo
 * for handle assignment.
 *
 * IMPORTANT: do not reorder casually - order is part of the public contract
 * (agent 0 -> normal, agent 1 -> intercity, ...). Tests pin the mapping.
 */
export const TRAIN_TYPES: TrainTypeEntry[] = [
  {
    type: 'normal',
    label: 'Normal',
    colors: {
      default: 'rgba(110,110,110,0.7)',
      focus:   'rgba(0,0,0,0.7)',
      muted:   'rgba(207,207,207,0.7)',
      related: 'rgba(122,122,122,0.7)',
    },
    colorsSolid: {
      default: '#6E6E6E',
      focus:   '#000000',
      muted:   '#CFCFCF',
      related: '#7A7A7A',
    },
  },
  {
    type: 'intercity',
    label: 'Intercity',
    colors: {
      default: 'rgba(162,127,176,0.7)',
      focus:   'rgba(118,44,143,0.7)',
      muted:   'rgba(217,202,218,0.7)',
      related: 'rgba(169,134,178,0.7)',
    },
    colorsSolid: {
      default: '#A27FB0',
      focus:   '#762C8F',
      muted:   '#D9CADA',
      related: '#A986B2',
    },
  },
  {
    type: 'interregio',
    label: 'Interregio / Regio Express',
    colors: {
      default: 'rgba(200,135,166,0.7)',
      focus:   'rgba(178,74,135,0.7)',
      muted:   'rgba(226,200,211,0.7)',
      related: 'rgba(201,143,170,0.7)',
    },
    colorsSolid: {
      default: '#C887A6',
      focus:   '#B24A87',
      muted:   '#E2C8D3',
      related: '#C98FAA',
    },
  },
  {
    type: 'sbahn',
    label: 'S-Bahn',
    colors: {
      default: 'rgba(138,143,177,0.7)',
      focus:   'rgba(60,63,143,0.7)',
      muted:   'rgba(208,210,227,0.7)',
      related: 'rgba(145,149,181,0.7)',
    },
    colorsSolid: {
      default: '#8A8FB1',
      focus:   '#3C3F8F',
      muted:   '#D0D2E3',
      related: '#9195B5',
    },
  },
  {
    type: 'sbahnWerktag',
    label: 'S-Bahn, Werktag',
    colors: {
      default: 'rgba(118,169,201,0.7)',
      focus:   'rgba(28,120,181,0.7)',
      muted:   'rgba(199,220,232,0.7)',
      related: 'rgba(127,175,208,0.7)',
    },
    colorsSolid: {
      default: '#76A9C9',
      focus:   '#1C78B5',
      muted:   '#C7DCE8',
      related: '#7FAFD0',
    },
  },
  {
    type: 'gueterzug',
    label: 'Güterzug',
    colors: {
      default: 'rgba(110,110,110,0.7)',
      focus:   'rgba(0,0,0,0.7)',
      muted:   'rgba(207,207,207,0.7)',
      related: 'rgba(122,122,122,0.7)',
    },
    colorsSolid: {
      default: '#6E6E6E',
      focus:   '#000000',
      muted:   '#CFCFCF',
      related: '#7A7A7A',
    },
  },
];

/**
 * Reserved global UI colours (NOT for agents).
 * Mirrored as CSS variables in styles.scss; keep in sync.
 */
export const GLOBAL_COLORS = {
  default:    'rgba(122,122,122,0.52)',
  focus:      'rgba(0,0,0,1)',
  muted:      'rgba(189,189,189,0.10)',
  focusEdit:  'rgba(57,184,179,0.52)',
  related:    'rgba(122,122,122,0.52)',
  warning:    'rgba(242,201,76,0.52)',
} as const;
