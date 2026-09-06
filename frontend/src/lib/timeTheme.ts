export type TimeMode = 'morning' | 'evening' | 'night';

export type TimeTheme = {
  bg: string;
  fog: string;
  ground: string;
  road: string;
  ambient: number;
  sun: number;
  sunColor: string;
  sunPos: [number, number, number];
};

export const TIME_THEMES: Record<TimeMode, TimeTheme> = {
  morning: {
    bg: '#a8cbe0',
    fog: '#b7d6e6',
    ground: '#718b79',
    road: '#303842',
    ambient: 1.05,
    sun: 2.0,
    sunColor: '#fff0cf',
    sunPos: [-35, 45, 25],
  },
  evening: {
    bg: '#9b6b72',
    fog: '#a77a79',
    ground: '#52605c',
    road: '#252934',
    ambient: 0.72,
    sun: 1.45,
    sunColor: '#ffb27a',
    sunPos: [35, 22, -25],
  },
  night: {
    bg: '#07111e',
    fog: '#07111e',
    ground: '#172233',
    road: '#090f1a',
    ambient: 0.5,
    sun: 1.45,
    sunColor: '#dcecff',
    sunPos: [25, 55, 18],
  },
};
