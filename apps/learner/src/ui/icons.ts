export const ICON_PATHS = {
  home: ['M3 11 12 4l9 7', 'M5 10v10h14V10'],
  book: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z', 'M4 19V5'],
  flame: ['M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5'],
  check: ['M20 6 9 17l-5-5'],
  close: ['M6 6l12 12M18 6 6 18'],
  speaker: ['M11 5 6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'],
  arrow: ['M5 12h14M13 6l6 6-6 6'],
  back: ['M19 12H5M11 6l-6 6 6 6'],
  people: [
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',
    'M2.5 20a6.5 6.5 0 0 1 13 0',
    'M16 4.5a3.5 3.5 0 0 1 0 6.5',
    'M18 14a6.5 6.5 0 0 1 3.5 6',
  ],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M4 21a8 8 0 0 1 16 0'],
} as const;

export type IconName = keyof typeof ICON_PATHS;
