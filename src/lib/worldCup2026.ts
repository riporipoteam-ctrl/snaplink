export interface WorldCupTeam {
  name: string;
  code: string;
  slug: string;
}

export interface WorldCupGroup {
  id: string;
  featuredVenue: string;
  teams: WorldCupTeam[];
}

export interface WorldCupFixtureDay {
  date: string;
  label: string;
  matches: Array<{
    group: string;
    fixture: string;
    venue: string;
  }>;
}

export const WORLD_CUP_2026_START = '2026-06-11T00:00:00+02:00';
export const WORLD_CUP_2026_END = '2026-07-19T23:59:59+02:00';

export const WORLD_CUP_2026_HOST_CITIES = [
  'Atlanta',
  'Boston',
  'Dallas',
  'Guadalajara',
  'Houston',
  'Kansas City',
  'Los Angeles',
  'Mexico City',
  'Miami',
  'Monterrey',
  'New York / New Jersey',
  'Philadelphia',
  'San Francisco Bay Area',
  'Seattle',
  'Toronto',
  'Vancouver',
];

export const WORLD_CUP_2026_GROUPS: WorldCupGroup[] = [
  {
    id: 'Group A',
    featuredVenue: 'Mexico City Stadium / Estadio Guadalajara',
    teams: [
      { name: 'Mexico', code: 'MEX', slug: 'mexico' },
      { name: 'South Africa', code: 'RSA', slug: 'south-africa' },
      { name: 'Korea Republic', code: 'KOR', slug: 'korea-republic' },
      { name: 'Czechia', code: 'CZE', slug: 'czechia' },
    ],
  },
  {
    id: 'Group B',
    featuredVenue: 'Toronto Stadium / BC Place Vancouver',
    teams: [
      { name: 'Canada', code: 'CAN', slug: 'canada' },
      { name: 'Bosnia and Herzegovina', code: 'BIH', slug: 'bosnia-and-herzegovina' },
      { name: 'Qatar', code: 'QAT', slug: 'qatar' },
      { name: 'Switzerland', code: 'SUI', slug: 'switzerland' },
    ],
  },
  {
    id: 'Group C',
    featuredVenue: 'Boston Stadium / New York New Jersey Stadium',
    teams: [
      { name: 'Haiti', code: 'HAI', slug: 'haiti' },
      { name: 'Scotland', code: 'SCO', slug: 'scotland' },
      { name: 'Brazil', code: 'BRA', slug: 'brazil' },
      { name: 'Morocco', code: 'MAR', slug: 'morocco' },
    ],
  },
  {
    id: 'Group D',
    featuredVenue: 'Los Angeles Stadium / BC Place Vancouver',
    teams: [
      { name: 'USA', code: 'USA', slug: 'usa' },
      { name: 'Paraguay', code: 'PAR', slug: 'paraguay' },
      { name: 'Australia', code: 'AUS', slug: 'australia' },
      { name: 'Turkiye', code: 'TUR', slug: 'turkiye' },
    ],
  },
  {
    id: 'Group E',
    featuredVenue: 'Philadelphia Stadium / Houston Stadium',
    teams: [
      { name: "Cote d'Ivoire", code: 'CIV', slug: 'cote-divoire' },
      { name: 'Ecuador', code: 'ECU', slug: 'ecuador' },
      { name: 'Germany', code: 'GER', slug: 'germany' },
      { name: 'Curacao', code: 'CUW', slug: 'curacao' },
    ],
  },
  {
    id: 'Group F',
    featuredVenue: 'Dallas Stadium / Estadio Monterrey',
    teams: [
      { name: 'Netherlands', code: 'NED', slug: 'netherlands' },
      { name: 'Japan', code: 'JPN', slug: 'japan' },
      { name: 'Sweden', code: 'SWE', slug: 'sweden' },
      { name: 'Tunisia', code: 'TUN', slug: 'tunisia' },
    ],
  },
  {
    id: 'Group G',
    featuredVenue: 'Los Angeles Stadium / BC Place Vancouver',
    teams: [
      { name: 'Belgium', code: 'BEL', slug: 'belgium' },
      { name: 'IR Iran', code: 'IRN', slug: 'ir-iran' },
      { name: 'New Zealand', code: 'NZL', slug: 'new-zealand' },
      { name: 'Egypt', code: 'EGY', slug: 'egypt' },
    ],
  },
  {
    id: 'Group H',
    featuredVenue: 'Miami Stadium / Atlanta Stadium',
    teams: [
      { name: 'Uruguay', code: 'URU', slug: 'uruguay' },
      { name: 'Cabo Verde', code: 'CPV', slug: 'cabo-verde' },
      { name: 'Spain', code: 'ESP', slug: 'spain' },
      { name: 'Saudi Arabia', code: 'KSA', slug: 'saudi-arabia' },
    ],
  },
  {
    id: 'Group I',
    featuredVenue: 'Boston Stadium / Toronto Stadium',
    teams: [
      { name: 'Norway', code: 'NOR', slug: 'norway' },
      { name: 'France', code: 'FRA', slug: 'france' },
      { name: 'Senegal', code: 'SEN', slug: 'senegal' },
      { name: 'Iraq', code: 'IRQ', slug: 'iraq' },
    ],
  },
  {
    id: 'Group J',
    featuredVenue: 'Kansas City Stadium / Dallas Stadium',
    teams: [
      { name: 'Algeria', code: 'ALG', slug: 'algeria' },
      { name: 'Austria', code: 'AUT', slug: 'austria' },
      { name: 'Jordan', code: 'JOR', slug: 'jordan' },
      { name: 'Argentina', code: 'ARG', slug: 'argentina' },
    ],
  },
  {
    id: 'Group K',
    featuredVenue: 'Miami Stadium / Atlanta Stadium',
    teams: [
      { name: 'Colombia', code: 'COL', slug: 'colombia' },
      { name: 'Portugal', code: 'POR', slug: 'portugal' },
      { name: 'Congo DR', code: 'COD', slug: 'congo-dr' },
      { name: 'Uzbekistan', code: 'UZB', slug: 'uzbekistan' },
    ],
  },
  {
    id: 'Group L',
    featuredVenue: 'New York New Jersey Stadium / Philadelphia Stadium',
    teams: [
      { name: 'Panama', code: 'PAN', slug: 'panama' },
      { name: 'England', code: 'ENG', slug: 'england' },
      { name: 'Croatia', code: 'CRO', slug: 'croatia' },
      { name: 'Ghana', code: 'GHA', slug: 'ghana' },
    ],
  },
];

export const WORLD_CUP_2026_FIXTURE_DAYS: WorldCupFixtureDay[] = [
  {
    date: '2026-06-11',
    label: 'Opening day',
    matches: [
      { group: 'A', fixture: 'Mexico vs South Africa', venue: 'Mexico City Stadium' },
      { group: 'A', fixture: 'Korea Republic vs Czechia', venue: 'Estadio Guadalajara' },
    ],
  },
  {
    date: '2026-06-12',
    label: 'North America spotlight',
    matches: [
      { group: 'B', fixture: 'Canada vs Bosnia and Herzegovina', venue: 'Toronto Stadium' },
      { group: 'D', fixture: 'USA vs Paraguay', venue: 'Los Angeles Stadium' },
    ],
  },
  {
    date: '2026-06-13',
    label: 'Heavyweight Saturday',
    matches: [
      { group: 'C', fixture: 'Haiti vs Scotland', venue: 'Boston Stadium' },
      { group: 'D', fixture: 'Australia vs Turkiye', venue: 'BC Place Vancouver' },
      { group: 'C', fixture: 'Brazil vs Morocco', venue: 'New York New Jersey Stadium' },
      { group: 'B', fixture: 'Qatar vs Switzerland', venue: 'San Francisco Bay Area Stadium' },
    ],
  },
  {
    date: '2026-06-14',
    label: 'Group board lights up',
    matches: [
      { group: 'E', fixture: "Cote d'Ivoire vs Ecuador", venue: 'Philadelphia Stadium' },
      { group: 'E', fixture: 'Germany vs Curacao', venue: 'Houston Stadium' },
      { group: 'F', fixture: 'Netherlands vs Japan', venue: 'Dallas Stadium' },
      { group: 'F', fixture: 'Sweden vs Tunisia', venue: 'Estadio Monterrey' },
    ],
  },
  {
    date: '2026-06-18',
    label: 'Second round pulse',
    matches: [
      { group: 'A', fixture: 'Czechia vs South Africa', venue: 'Atlanta Stadium' },
      { group: 'B', fixture: 'Switzerland vs Bosnia and Herzegovina', venue: 'Los Angeles Stadium' },
      { group: 'B', fixture: 'Canada vs Qatar', venue: 'BC Place Vancouver' },
      { group: 'A', fixture: 'Mexico vs Korea Republic', venue: 'Estadio Guadalajara' },
    ],
  },
  {
    date: '2026-06-21',
    label: 'Final groups arrive',
    matches: [
      { group: 'H', fixture: 'Uruguay vs Cabo Verde', venue: 'Miami Stadium' },
      { group: 'H', fixture: 'Spain vs Saudi Arabia', venue: 'Atlanta Stadium' },
      { group: 'G', fixture: 'Belgium vs IR Iran', venue: 'Los Angeles Stadium' },
      { group: 'G', fixture: 'New Zealand vs Egypt', venue: 'BC Place Vancouver' },
    ],
  },
];

export const WORLD_CUP_QUALIFIED_TEAMS = WORLD_CUP_2026_GROUPS.flatMap((group) => group.teams);

export function getWorldCupHatMeta(decorationId?: string | null) {
  if (!decorationId?.startsWith('hat-')) return null;
  const slug = decorationId.replace(/^hat-/, '');
  const team = WORLD_CUP_QUALIFIED_TEAMS.find((entry) => entry.slug === slug);
  if (!team) return null;

  const hue = Math.abs(
    team.slug.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360
  );

  return {
    ...team,
    decorationId,
    background: `linear-gradient(135deg, hsl(${hue} 78% 52%), hsl(${(hue + 48) % 360} 76% 44%))`,
  };
}
