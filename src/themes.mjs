// Theme palettes. Ten roles (the pixel house style) plus six syntax colours.
// A theme is exactly one block of CSS custom properties; components never hard-code colours.
// order: canvas panel raised line shadow hi accent accentdark text muted | kw str num com fn type
const R = ['canvas', 'panel', 'raised', 'line', 'shadow', 'hi', 'accent', 'accentdark', 'text', 'muted',
  'kw', 'str', 'num', 'com', 'fn', 'type'];

const T = (id, name, light, v) => ({ id, name, light, colors: Object.fromEntries(R.map((k, i) => [k, v[i]])) });

export const THEMES = [
  T('castle', 'Castle', false, ['#1C1B20', '#302A2B', '#403634', '#6D5540', '#101014', '#8B6A45', '#F0C579', '#52402A', '#F4E8D1', '#BAAA92',
    '#E8906A', '#A9CF7E', '#F0C579', '#A8987F', '#86C4E0', '#D9A0CE']),
  T('ember', 'Ember', false, ['#17090B', '#2A1215', '#3A191D', '#7A2E35', '#0C0405', '#A8434B', '#FF6A70', '#5A1A1F', '#F6E4E1', '#C7A09E',
    '#FF8A8F', '#EDC785', '#FFA860', '#B08A8A', '#F4B8A4', '#E0A0C0']),
  T('forest', 'Forest', false, ['#101A14', '#1B2B21', '#26392C', '#4E7A58', '#08100B', '#6FA37B', '#9BE08A', '#2E5A36', '#E2F2DF', '#A3C0A8',
    '#E8A878', '#E8DC8A', '#F0C070', '#86A68C', '#7CD0C0', '#C8A8E0']),
  T('lagoon', 'Lagoon', false, ['#0B1A22', '#12303B', '#1A4452', '#2F7A8C', '#06101A', '#4FA7BA', '#5FE0D0', '#1A5A55', '#DDF3F5', '#9CC2C9',
    '#F0A080', '#B8E08A', '#F4D070', '#80A8B0', '#80C8F0', '#D0A8E8']),
  T('amber', 'Amber CRT', false, ['#120C02', '#231805', '#33240A', '#7A5512', '#080500', '#B07A1C', '#FFB000', '#5C3E00', '#FFD98A', '#C99A45',
    '#FFC040', '#FFE49A', '#FFA020', '#A8801E', '#FFD060', '#E8B060']),
  T('night', 'Night', false, ['#0D1020', '#181C36', '#232950', '#4A5496', '#070913', '#6B78C8', '#8FB4FF', '#2A3A78', '#E6E9FA', '#A4AAD0',
    '#F09AB0', '#A8E0A0', '#F8C880', '#8088B8', '#88D0F0', '#C8A8F0']),
  T('parchment', 'Parchment', true, ['#F1E4C8', '#E3D1AA', '#EBDDBB', '#A88B5A', '#B99B66', '#FFF6DF', '#8B3A1E', '#D9BE8A', '#2E2012', '#5E4A30',
    '#9A3A1A', '#3A5E18', '#7A4E00', '#6E5A3E', '#1F5A80', '#7A3A70']),
  T('paper', 'Paper', true, ['#FBFBF8', '#E9E9E2', '#F2F2EC', '#A5A59A', '#8C8C82', '#FFFFFF', '#B3261E', '#F3C9C5', '#1B1B1A', '#55554F',
    '#B3261E', '#1A6B2A', '#8A4A00', '#66665F', '#0B5CAD', '#6F3A9E']),
  T('gameboy', 'Game Boy', false, ['#9BBC0F', '#8BAC0F', '#9BBC0F', '#306230', '#0F380F', '#C4DC4A', '#0F380F', '#8BAC0F', '#0F380F', '#1E4A1E',
    '#0F380F', '#1E4A1E', '#0F380F', '#1E4A1E', '#0F380F', '#1E4A1E']),
  T('mono', 'Mono', false, ['#111111', '#222222', '#2E2E2E', '#666666', '#000000', '#8A8A8A', '#FFFFFF', '#444444', '#E8E8E8', '#A8A8A8',
    '#FFFFFF', '#D0D0D0', '#B8B8B8', '#8E8E8E', '#EDEDED', '#C4C4C4']),
];

export const themeCss = () => THEMES.map(t =>
  `[data-theme="${t.id}"]{color-scheme:${t.light ? 'light' : 'dark'};` +
  Object.entries(t.colors).map(([k, v]) => `--${k}:${v}`).join(';') + '}').join('\n');
