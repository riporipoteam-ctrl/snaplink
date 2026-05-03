import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Star, Users, ThumbsUp, ArrowLeft, Gamepad2, Trophy, Zap, Swords, Timer, Sparkles, Mountain, Ghost, Paintbrush, Brain, Flag, Dog, Music, ChefHat, Building2, Bomb, Crown, Puzzle, Dumbbell, Plane, Tent, Rocket, Globe, Heart, Shield } from 'lucide-react';

// Lazy-loaded game components
const SocialHub = lazy(() => import('./games/SocialHub').then(m => ({ default: m.SocialHub })));
const ObbyParadise = lazy(() => import('./games/ObbyParadise').then(m => ({ default: m.ObbyParadise })));
const SpeedRacers = lazy(() => import('./games/SpeedRacers').then(m => ({ default: m.SpeedRacers })));
const BattleArena = lazy(() => import('./games/BattleArena').then(m => ({ default: m.BattleArena })));
const ParkourCity = lazy(() => import('./games/ParkourCity').then(m => ({ default: m.ParkourCity })));
const RecRoom = lazy(() => import('./games/RecRoom').then(m => ({ default: m.RecRoom })));

// ============= GAME DATA =============
interface GameInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  gradient: string;
  players: string;
  likes: string;
  rating: number;
  playable: boolean;
  featured?: boolean;
  isNew?: boolean;
  isHot?: boolean;
  tags: string[];
}

const CATEGORIES = [
  { id: 'all', label: 'All Games', icon: <Gamepad2 size={16} /> },
  { id: 'popular', label: 'Popular', icon: <Star size={16} /> },
  { id: 'social', label: 'Social', icon: <Users size={16} /> },
  { id: 'adventure', label: 'Adventure', icon: <Mountain size={16} /> },
  { id: 'action', label: 'Action', icon: <Swords size={16} /> },
  { id: 'racing', label: 'Racing', icon: <Zap size={16} /> },
  { id: 'puzzle', label: 'Puzzle', icon: <Puzzle size={16} /> },
  { id: 'creative', label: 'Creative', icon: <Paintbrush size={16} /> },
  { id: 'sports', label: 'Sports', icon: <Dumbbell size={16} /> },
  { id: 'horror', label: 'Horror', icon: <Ghost size={16} /> },
];

const GAMES: GameInfo[] = [
  {
    id: 'social-hub',
    name: 'SnapLink City',
    description: 'Explore the neon cyberpunk metropolis! Chat, dance, and hang out with friends in this massive multiplayer social world.',
    category: 'social',
    icon: <Building2 size={40} />,
    gradient: 'from-violet-600 via-purple-600 to-indigo-700',
    players: '1.2K',
    likes: '45.8K',
    rating: 4.8,
    playable: true,
    featured: true,
    isHot: true,
    tags: ['social', 'popular', 'multiplayer'],
  },
  {
    id: 'obby-paradise',
    name: 'Obby Paradise',
    description: 'Jump, climb, and dodge your way through 50+ challenging obstacle courses! Can you reach the end?',
    category: 'adventure',
    icon: <Mountain size={40} />,
    gradient: 'from-emerald-500 via-green-500 to-teal-600',
    players: '856',
    likes: '38.2K',
    rating: 4.7,
    playable: true,
    isHot: true,
    tags: ['adventure', 'popular', 'obby'],
  },
  {
    id: 'speed-racers',
    name: 'Speed Racers',
    description: 'Race at breakneck speeds on neon-lit tracks! Drift through corners, collect nitro, and cross the finish line first.',
    category: 'racing',
    icon: <Zap size={40} />,
    gradient: 'from-orange-500 via-red-500 to-pink-600',
    players: '634',
    likes: '29.5K',
    rating: 4.6,
    playable: true,
    isNew: true,
    tags: ['racing', 'popular', 'action'],
  },
  {
    id: 'battle-arena',
    name: 'Battle Arena',
    description: 'Enter the arena and prove your worth! PvP combat with swords, power-ups, and epic knockback physics.',
    category: 'action',
    icon: <Swords size={40} />,
    gradient: 'from-red-600 via-rose-600 to-red-800',
    players: '1.1K',
    likes: '52.3K',
    rating: 4.9,
    playable: true,
    featured: true,
    isHot: true,
    tags: ['action', 'popular', 'pvp'],
  },
  {
    id: 'parkour-city',
    name: 'Parkour City',
    description: 'Free-run across rooftops, wall-jump between skyscrapers, and zipline through a massive neon city!',
    category: 'adventure',
    icon: <Rocket size={40} />,
    gradient: 'from-cyan-500 via-blue-500 to-indigo-600',
    players: '723',
    likes: '31.4K',
    rating: 4.5,
    playable: true,
    isNew: true,
    tags: ['adventure', 'popular', 'parkour'],
  },
  {
    id: 'rec-room',
    name: 'Rec Room',
    description: 'Play Rec Room in your browser! Explore creative rooms, play mini-games, and hang out with friends — streamed from your PC via RipoTeam.',
    category: 'social',
    icon: <Gamepad2 size={40} />,
    gradient: 'from-blue-500 via-indigo-600 to-purple-700',
    players: '50',
    likes: '10.5K',
    rating: 4.7,
    playable: true,
    featured: false,
    isNew: true,
    isHot: true,
    tags: ['social', 'popular', 'multiplayer', 'action', 'creative'],
  },
  {
    id: 'tower-of-doom',
    name: 'Tower of Doom',
    description: 'Climb the infinite tower! Each floor has new challenges, traps, and secrets. How high can you go?',
    category: 'adventure',
    icon: <Trophy size={40} />,
    gradient: 'from-amber-500 via-orange-600 to-red-700',
    players: '445',
    likes: '22.1K',
    rating: 4.4,
    playable: false,
    tags: ['adventure', 'tower'],
  },
  {
    id: 'murder-mystery',
    name: 'Murder Mystery',
    description: 'One player is the murderer, one is the sheriff. Can you figure out who the killer is before it\'s too late?',
    category: 'horror',
    icon: <Ghost size={40} />,
    gradient: 'from-gray-700 via-gray-800 to-black',
    players: '892',
    likes: '41.7K',
    rating: 4.7,
    playable: false,
    isHot: true,
    tags: ['horror', 'popular', 'mystery'],
  },
  {
    id: 'capture-flag',
    name: 'Capture the Flag',
    description: 'Team-based CTF action! Raid the enemy base, grab their flag, and bring it back to score. Teamwork is key!',
    category: 'action',
    icon: <Flag size={40} />,
    gradient: 'from-blue-600 via-indigo-600 to-purple-700',
    players: '367',
    likes: '18.9K',
    rating: 4.3,
    playable: false,
    tags: ['action', 'team'],
  },
  {
    id: 'pet-simulator',
    name: 'Pet Paradise',
    description: 'Collect over 200 adorable pets! Train them, evolve them, and show them off to your friends.',
    category: 'social',
    icon: <Dog size={40} />,
    gradient: 'from-pink-400 via-rose-500 to-pink-600',
    players: '1.5K',
    likes: '67.3K',
    rating: 4.8,
    playable: false,
    isHot: true,
    tags: ['social', 'popular', 'pets'],
  },
  {
    id: 'dance-party',
    name: 'Dance Party',
    description: 'Hit the dance floor! Rhythm game meets social hangout. Compete for the best moves and win trophies.',
    category: 'social',
    icon: <Music size={40} />,
    gradient: 'from-fuchsia-500 via-purple-500 to-violet-600',
    players: '534',
    likes: '25.6K',
    rating: 4.5,
    playable: false,
    tags: ['social', 'music'],
  },
  {
    id: 'cooking-frenzy',
    name: 'Cooking Frenzy',
    description: 'Run your own restaurant! Cook dishes, serve customers, and expand your culinary empire.',
    category: 'creative',
    icon: <ChefHat size={40} />,
    gradient: 'from-yellow-500 via-amber-500 to-orange-600',
    players: '289',
    likes: '15.4K',
    rating: 4.2,
    playable: false,
    tags: ['creative', 'simulation'],
  },
  {
    id: 'zombie-survival',
    name: 'Zombie Apocalypse',
    description: 'Survive endless waves of zombies! Build defenses, craft weapons, and fight for survival.',
    category: 'action',
    icon: <Bomb size={40} />,
    gradient: 'from-green-700 via-emerald-800 to-green-900',
    players: '678',
    likes: '35.8K',
    rating: 4.6,
    playable: false,
    tags: ['action', 'horror', 'survival'],
  },
  {
    id: 'build-battle',
    name: 'Build Battle',
    description: 'Get a theme, build something amazing, and have other players vote! The most creative builder wins.',
    category: 'creative',
    icon: <Paintbrush size={40} />,
    gradient: 'from-sky-400 via-cyan-500 to-blue-600',
    players: '412',
    likes: '20.3K',
    rating: 4.4,
    playable: false,
    tags: ['creative', 'popular'],
  },
  {
    id: 'quiz-show',
    name: 'Brain Blast Quiz',
    description: 'Test your knowledge in this fast-paced trivia game! Thousands of questions across dozens of categories.',
    category: 'puzzle',
    icon: <Brain size={40} />,
    gradient: 'from-indigo-500 via-blue-600 to-violet-700',
    players: '234',
    likes: '12.8K',
    rating: 4.3,
    playable: false,
    tags: ['puzzle', 'trivia'],
  },
  {
    id: 'tycoon-empire',
    name: 'Tycoon Empire',
    description: 'Start from nothing and build a massive business empire! Manage resources, expand, and dominate the market.',
    category: 'creative',
    icon: <Crown size={40} />,
    gradient: 'from-amber-400 via-yellow-500 to-amber-600',
    players: '567',
    likes: '33.1K',
    rating: 4.6,
    playable: false,
    isHot: true,
    tags: ['creative', 'popular', 'tycoon'],
  },
  {
    id: 'sky-wars',
    name: 'Sky Wars',
    description: 'Battle on floating islands in the sky! Gear up with weapons, build bridges, and knock enemies into the void.',
    category: 'action',
    icon: <Plane size={40} />,
    gradient: 'from-sky-300 via-blue-400 to-indigo-500',
    players: '445',
    likes: '24.7K',
    rating: 4.5,
    playable: false,
    tags: ['action', 'pvp'],
  },
  {
    id: 'escape-room',
    name: 'Escape Room',
    description: 'Solve puzzles, find clues, and escape before time runs out! Multiple themed rooms to conquer.',
    category: 'puzzle',
    icon: <Timer size={40} />,
    gradient: 'from-emerald-600 via-teal-600 to-cyan-700',
    players: '198',
    likes: '11.2K',
    rating: 4.2,
    playable: false,
    tags: ['puzzle', 'escape'],
  },
  {
    id: 'fashion-show',
    name: 'Fashion Runway',
    description: 'Design outfits, walk the runway, and get rated by other players! Express your style.',
    category: 'social',
    icon: <Sparkles size={40} />,
    gradient: 'from-rose-400 via-pink-500 to-fuchsia-600',
    players: '312',
    likes: '19.5K',
    rating: 4.4,
    playable: false,
    tags: ['social', 'creative'],
  },
  {
    id: 'sword-fight',
    name: 'Sword Masters',
    description: 'Master the blade in this skill-based sword fighting game! Parry, counter, and slice your way to glory.',
    category: 'action',
    icon: <Shield size={40} />,
    gradient: 'from-slate-600 via-gray-700 to-zinc-800',
    players: '389',
    likes: '27.3K',
    rating: 4.5,
    playable: false,
    tags: ['action', 'pvp', 'combat'],
  },
  {
    id: 'camping-trip',
    name: 'Camping Trip',
    description: 'Go on a spooky camping adventure! Explore the woods, tell scary stories, and survive the night.',
    category: 'horror',
    icon: <Tent size={40} />,
    gradient: 'from-green-800 via-emerald-900 to-green-950',
    players: '267',
    likes: '14.6K',
    rating: 4.3,
    playable: false,
    tags: ['horror', 'adventure'],
  },
  {
    id: 'space-explorers',
    name: 'Space Explorers',
    description: 'Explore the galaxy, discover new planets, build space stations, and encounter alien life!',
    category: 'adventure',
    icon: <Globe size={40} />,
    gradient: 'from-indigo-800 via-purple-900 to-violet-950',
    players: '456',
    likes: '28.9K',
    rating: 4.6,
    playable: false,
    tags: ['adventure', 'space'],
  },
  {
    id: 'love-story',
    name: 'Love Story RP',
    description: 'Live out your drama! Roleplay in a school setting with friendships, rivalries, and maybe even love.',
    category: 'social',
    icon: <Heart size={40} />,
    gradient: 'from-red-400 via-rose-500 to-pink-600',
    players: '789',
    likes: '42.1K',
    rating: 4.5,
    playable: false,
    tags: ['social', 'popular', 'roleplay'],
  },
];

// ============= GAME CARD =============
function GameCard({ game, onPlay }: { game: GameInfo; onPlay: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className="relative group cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onPlay}
    >
      <div className="bg-gray-800/80 rounded-2xl overflow-hidden border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 shadow-lg hover:shadow-purple-500/20">
        {/* Thumbnail */}
        <div className={`relative h-40 bg-gradient-to-br ${game.gradient} flex items-center justify-center overflow-hidden`}>
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.1) 0%, transparent 50%)',
            }} />
            <div className="absolute top-0 left-0 w-full h-full" style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.05) 35px, rgba(255,255,255,0.05) 70px)',
            }} />
          </div>

          {/* Game icon */}
          <div className="text-white/90 transform transition-transform duration-300 group-hover:scale-110">
            {game.icon}
          </div>

          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1.5">
            {game.isNew && (
              <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                New
              </span>
            )}
            {game.isHot && (
              <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                🔥 Hot
              </span>
            )}
            {game.featured && (
              <span className="bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                ⭐ Featured
              </span>
            )}
          </div>

          {/* Player count */}
          <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <Users size={12} />
            <span>{game.players}</span>
          </div>

          {/* Play overlay on hover */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                className="absolute inset-0 bg-black/40 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.button
                  className={`px-6 py-3 rounded-xl font-bold text-base shadow-lg ${
                    game.playable
                      ? 'bg-green-500 hover:bg-green-400 text-white'
                      : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  }`}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  whileHover={game.playable ? { scale: 1.05 } : {}}
                  whileTap={game.playable ? { scale: 0.95 } : {}}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay();
                  }}
                >
                  {game.playable ? '▶ Play' : '🔒 Coming Soon'}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info */}
        <div className="p-3.5">
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-bold text-white text-sm leading-tight truncate flex-1">{game.name}</h3>
            <div className="flex items-center gap-0.5 ml-2 shrink-0">
              <Star size={12} className="text-yellow-400 fill-yellow-400" />
              <span className="text-yellow-400 text-xs font-semibold">{game.rating}</span>
            </div>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-2">{game.description}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-gray-500 text-xs">
              <ThumbsUp size={11} />
              <span>{game.likes}</span>
            </div>
            <span className="text-[10px] text-purple-400 font-medium uppercase tracking-wide bg-purple-500/10 px-2 py-0.5 rounded-full">
              {game.category}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============= FEATURED HERO =============
function FeaturedHero({ game, onPlay }: { game: GameInfo; onPlay: () => void }) {
  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden bg-gradient-to-r ${game.gradient} p-0.5 cursor-pointer`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={onPlay}
    >
      <div className="relative rounded-[14px] overflow-hidden bg-gradient-to-r from-black/20 to-transparent">
        <div className="flex flex-col md:flex-row items-center gap-6 p-6 md:p-8">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
                ⭐ FEATURED GAME
              </span>
              {game.isHot && (
                <span className="bg-orange-500/80 text-white text-xs font-bold px-3 py-1 rounded-full">
                  🔥 TRENDING
                </span>
              )}
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3 drop-shadow-lg">{game.name}</h2>
            <p className="text-white/80 text-sm md:text-base mb-4 max-w-md leading-relaxed">{game.description}</p>
            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center gap-1.5 text-white/70">
                <Users size={16} />
                <span className="text-sm font-medium">{game.players} playing</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/70">
                <ThumbsUp size={16} />
                <span className="text-sm font-medium">{game.likes}</span>
              </div>
              <div className="flex items-center gap-1 text-yellow-300">
                <Star size={16} className="fill-yellow-300" />
                <span className="text-sm font-bold">{game.rating}</span>
              </div>
            </div>
            <motion.button
              className="bg-white text-gray-900 font-bold text-lg px-8 py-3 rounded-xl shadow-lg hover:shadow-xl"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
            >
              ▶ Play Now
            </motion.button>
          </div>
          <div className="w-40 h-40 md:w-48 md:h-48 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center text-white/80 shadow-inner">
            <div className="transform scale-150">
              {game.icon}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============= LOADING SCREEN =============
function GameLoadingScreen({ gameName }: { gameName: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-gray-900">
      <motion.div
        className="relative w-24 h-24 mb-6"
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      >
        <div className="absolute inset-0 rounded-full border-4 border-purple-500/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500" />
      </motion.div>
      <h2 className="text-white text-xl font-bold mb-2">Loading {gameName}...</h2>
      <p className="text-gray-400 text-sm">Preparing your adventure</p>
      <div className="mt-6 w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 3, ease: 'easeInOut' }}
        />
      </div>
    </div>
  );
}

// ============= MAIN HUB =============
function GamesHub() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'popular' | 'new' | 'rating'>('popular');

  const featured = GAMES.find(g => g.id === 'battle-arena')!;
  const secondFeatured = GAMES.find(g => g.id === 'social-hub')!;

  const filteredGames = useMemo(() => {
    let result = [...GAMES];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(g =>
        g.name.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.tags.some(t => t.includes(q))
      );
    }
    if (activeCategory !== 'all') {
      result = result.filter(g => g.category === activeCategory || g.tags.includes(activeCategory));
    }
    result.sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'new') return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
      return parseFloat(b.likes.replace('K', '')) - parseFloat(a.likes.replace('K', ''));
    });
    return result;
  }, [search, activeCategory, sortBy]);

  const playableCount = GAMES.filter(g => g.playable).length;
  const totalPlayers = '4.8K';

  return (
    <div className="min-h-full bg-gray-900 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-800/80 to-transparent px-4 pt-4 pb-2">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Gamepad2 size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">SnapLink Games</h1>
                <p className="text-gray-400 text-xs">{GAMES.length} Games · {totalPlayers} Online · {playableCount} Playable</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search games..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-gray-700/50 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === cat.id
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 space-y-6">
        {/* Featured Heroes (only when not searching/filtering) */}
        {activeCategory === 'all' && !search && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FeaturedHero game={featured} onPlay={() => navigate(`/games/${featured.id}`)} />
            <FeaturedHero game={secondFeatured} onPlay={() => navigate(`/games/${secondFeatured.id}`)} />
          </div>
        )}

        {/* Sort controls */}
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">
            {activeCategory === 'all' ? 'All Games' : CATEGORIES.find(c => c.id === activeCategory)?.label}
            <span className="text-gray-500 font-normal text-sm ml-2">({filteredGames.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            {(['popular', 'new', 'rating'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  sortBy === s ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-white'
                }`}
              >
                {s === 'popular' ? 'Popular' : s === 'new' ? 'New' : 'Top Rated'}
              </button>
            ))}
          </div>
        </div>

        {/* Game Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredGames.map((game, i) => (
            <motion.div key={game.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <GameCard
                game={game}
                onPlay={() => {
                  if (game.playable) navigate(`/games/${game.id}`);
                }}
              />
            </motion.div>
          ))}
        </div>

        {filteredGames.length === 0 && (
          <div className="text-center py-16">
            <Gamepad2 size={48} className="text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No games found</p>
            <p className="text-gray-600 text-sm mt-1">Try a different search or category</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============= MAIN GAMES COMPONENT =============
export function Games() {
  const { gameId } = useParams<{ gameId?: string }>();
  const navigate = useNavigate();

  if (!gameId) {
    return <GamesHub />;
  }

  const game = GAMES.find(g => g.id === gameId);
  if (!game) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-900 gap-4">
        <Gamepad2 size={48} className="text-gray-600" />
        <p className="text-gray-400 text-lg">Game not found</p>
        <button onClick={() => navigate('/games')} className="text-purple-400 hover:text-purple-300 text-sm">
          ← Back to Games
        </button>
      </div>
    );
  }

  if (!game.playable) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-900 gap-4">
        <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${game.gradient} flex items-center justify-center text-white/80`}>
          {game.icon}
        </div>
        <h2 className="text-white text-2xl font-bold">{game.name}</h2>
        <p className="text-gray-400 text-sm max-w-md text-center">{game.description}</p>
        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-4 py-2 rounded-xl text-sm font-medium">
          🔒 Coming Soon — Stay tuned!
        </div>
        <button onClick={() => navigate('/games')} className="text-purple-400 hover:text-purple-300 text-sm mt-2 flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Games
        </button>
      </div>
    );
  }

  // Back button overlay
  const BackButton = () => (
    <motion.button
      className="fixed top-4 left-4 z-50 bg-black/60 hover:bg-black/80 text-white rounded-xl px-3 py-2 text-sm font-medium backdrop-blur-sm flex items-center gap-1.5 border border-white/10"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => navigate('/games')}
    >
      <ArrowLeft size={16} />
      Back
    </motion.button>
  );

  const GAME_COMPONENTS: Record<string, React.ReactNode> = {
    'social-hub': <><BackButton /><Suspense fallback={<GameLoadingScreen gameName={game.name} />}><SocialHub /></Suspense></>,
    'obby-paradise': <><BackButton /><Suspense fallback={<GameLoadingScreen gameName={game.name} />}><ObbyParadise /></Suspense></>,
    'speed-racers': <><BackButton /><Suspense fallback={<GameLoadingScreen gameName={game.name} />}><SpeedRacers /></Suspense></>,
    'battle-arena': <><BackButton /><Suspense fallback={<GameLoadingScreen gameName={game.name} />}><BattleArena /></Suspense></>,
    'parkour-city': <><BackButton /><Suspense fallback={<GameLoadingScreen gameName={game.name} />}><ParkourCity /></Suspense></>,
    'rec-room': <><BackButton /><Suspense fallback={<GameLoadingScreen gameName={game.name} />}><RecRoom /></Suspense></>,
  };

  return (
    <div className="w-full h-screen relative overflow-hidden">
      {GAME_COMPONENTS[gameId] || (
        <div className="h-full flex items-center justify-center bg-gray-900">
          <p className="text-gray-400">Game not available</p>
        </div>
      )}
    </div>
  );
}

export default Games;
