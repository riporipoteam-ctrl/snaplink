import React, { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Shuffle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './Button';

interface AvatarCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  currentAvatar?: string | null;
}

const SKIN_COLORS = [
  { id: 'light', label: 'Light', hex: '#FFDBB4' },
  { id: 'pale', label: 'Pale', hex: '#EDB98A' },
  { id: 'brown', label: 'Brown', hex: '#D08B5B' },
  { id: 'darkBrown', label: 'Dark Brown', hex: '#AE5D29' },
  { id: 'black', label: 'Black', hex: '#614335' },
  { id: 'yellow', label: 'Yellow', hex: '#F8D25C' },
];

const HAIR_STYLES = [
  'shortFlat', 'shortRound', 'shortWaved', 'shortCurly', 'bigHair', 'bob', 'bun',
  'curly', 'curvy', 'dreads', 'frizzle', 'fro', 'shaggy', 'shaggyMullet',
  'longButNotTooLong', 'miaWallace', 'straightAndStrand', 'straight01', 'straight02',
  'shavedSides', 'sides', 'theCaesar', 'theCaesarAndSidePart', 'froBand',
];

const HAIR_COLORS = [
  { id: 'black', hex: '#2C1B18' },
  { id: 'brown', hex: '#724133' },
  { id: 'blonde', hex: '#D6B370' },
  { id: 'red', hex: '#C93305' },
  { id: 'auburn', hex: '#A55728' },
  { id: 'platinum', hex: '#ECDCBF' },
  { id: 'blue', hex: '#4A90D9' },
  { id: 'pink', hex: '#F48FB1' },
  { id: 'purple', hex: '#9B59B6' },
  { id: 'green', hex: '#4CAF50' },
];

const ACCESSORIES = [
  { id: 'none', label: 'None' },
  { id: 'round', label: 'Round Glasses' },
  { id: 'prescription01', label: 'Prescription' },
  { id: 'prescription02', label: 'Prescription 2' },
  { id: 'sunglasses', label: 'Sunglasses' },
  { id: 'wayfarers', label: 'Wayfarers' },
  { id: 'kurt', label: 'Kurt Glasses' },
  { id: 'eyepatch', label: 'Eyepatch' },
];

const CLOTHING = [
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'blazerAndShirt', label: 'Blazer & Shirt' },
  { id: 'blazerAndSweater', label: 'Blazer & Sweater' },
  { id: 'collarAndSweater', label: 'Collar Sweater' },
  { id: 'shirtCrewNeck', label: 'Crew Neck' },
  { id: 'shirtScoopNeck', label: 'Scoop Neck' },
  { id: 'shirtVNeck', label: 'V-Neck' },
  { id: 'overall', label: 'Overall' },
  { id: 'graphicShirt', label: 'Graphic Shirt' },
];

const CLOTHING_COLORS = [
  { id: 'blue', hex: '#3B82F6' },
  { id: 'red', hex: '#EF4444' },
  { id: 'green', hex: '#22C55E' },
  { id: 'purple', hex: '#A855F7' },
  { id: 'pink', hex: '#EC4899' },
  { id: 'yellow', hex: '#EAB308' },
  { id: 'gray', hex: '#6B7280' },
  { id: 'black', hex: '#1F2937' },
  { id: 'white', hex: '#F3F4F6' },
  { id: 'orange', hex: '#F97316' },
];

const FACIAL_HAIR = [
  { id: 'none', label: 'None' },
  { id: 'beardLight', label: 'Light Beard' },
  { id: 'beardMedium', label: 'Medium Beard' },
  { id: 'beardMajestic', label: 'Majestic Beard' },
  { id: 'moustacheFancy', label: 'Fancy Moustache' },
  { id: 'moustacheMagnum', label: 'Magnum Moustache' },
];

const EXPRESSIONS = [
  { id: 'smile', label: 'Smile' },
  { id: 'default', label: 'Default' },
  { id: 'twinkle', label: 'Twinkle' },
  { id: 'tongue', label: 'Tongue' },
  { id: 'sad', label: 'Sad' },
  { id: 'serious', label: 'Serious' },
  { id: 'eating', label: 'Eating' },
  { id: 'grimace', label: 'Grimace' },
  { id: 'disbelief', label: 'Disbelief' },
  { id: 'concerned', label: 'Concerned' },
  { id: 'screamOpen', label: 'Scream' },
  { id: 'vomit', label: 'Vomit' },
];

const BACKGROUNDS = [
  { id: 'transparent', hex: 'transparent', label: 'None' },
  { id: 'b6e3f4', hex: '#b6e3f4', label: 'Light Blue' },
  { id: 'c0aede', hex: '#c0aede', label: 'Lavender' },
  { id: 'd1d4f9', hex: '#d1d4f9', label: 'Periwinkle' },
  { id: 'ffd5dc', hex: '#ffd5dc', label: 'Pink' },
  { id: 'ffdfbf', hex: '#ffdfbf', label: 'Peach' },
  { id: 'a3e635', hex: '#a3e635', label: 'Lime' },
  { id: 'fbbf24', hex: '#fbbf24', label: 'Amber' },
  { id: '67e8f9', hex: '#67e8f9', label: 'Cyan' },
  { id: 'f472b6', hex: '#f472b6', label: 'Hot Pink' },
];

const AVATAR_STYLES = [
  { id: 'avataaars', label: 'Classic' },
  { id: 'fun-emoji', label: 'Fun Emoji' },
  { id: 'bottts', label: 'Robot' },
  { id: 'pixel-art', label: 'Pixel Art' },
  { id: 'lorelei', label: 'Lorelei' },
  { id: 'adventurer', label: 'Adventurer' },
  { id: 'big-ears', label: 'Big Ears' },
  { id: 'croodles', label: 'Doodle' },
  { id: 'miniavs', label: 'Mini' },
  { id: 'open-peeps', label: 'Open Peeps' },
  { id: 'personas', label: 'Personas' },
  { id: 'notionists', label: 'Notionist' },
  { id: 'thumbs', label: 'Thumbs' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'identicon', label: 'Identicon' },
  { id: 'rings', label: 'Rings' },
  { id: 'initials', label: 'Initials' },
  { id: 'big-smile', label: 'Big Smile' },
];

type TabId =
  | 'style'
  | 'skin'
  | 'hair'
  | 'hairColor'
  | 'accessories'
  | 'clothing'
  | 'clothingColor'
  | 'facialHair'
  | 'expression'
  | 'background';

const TABS: { id: TabId; label: string }[] = [
  { id: 'style', label: 'Style' },
  { id: 'skin', label: 'Skin' },
  { id: 'hair', label: 'Hair' },
  { id: 'hairColor', label: 'Hair Color' },
  { id: 'accessories', label: 'Glasses' },
  { id: 'clothing', label: 'Clothing' },
  { id: 'clothingColor', label: 'Cloth Color' },
  { id: 'facialHair', label: 'Facial Hair' },
  { id: 'expression', label: 'Expression' },
  { id: 'background', label: 'Background' },
];

function normalizeHex(value?: string | null) {
  return String(value || '').replace('#', '').trim().toLowerCase();
}

function findColorIdByHex<T extends { id: string; hex: string }>(collection: T[], hex?: string | null, fallback?: string) {
  const normalized = normalizeHex(hex);
  return collection.find((entry) => normalizeHex(entry.hex) === normalized)?.id || fallback || collection[0]?.id || '';
}

function humanize(value: string) {
  return value.replace(/([A-Z])/g, ' $1').trim();
}

function parseCurrentAvatar(currentAvatar?: string | null) {
  if (!currentAvatar) return null;

  try {
    const parsedUrl = new URL(currentAvatar);
    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    const styleIndex = segments.findIndex((segment) => segment === '7.x');
    const params = parsedUrl.searchParams;
    const seedValue = params.get('seed') || '';

    return {
      style: styleIndex >= 0 ? segments[styleIndex + 1] || 'avataaars' : 'avataaars',
      seed: seedValue.split('_')[0] || Math.random().toString(36).substring(7),
      skinColor: findColorIdByHex(SKIN_COLORS, params.get('skinColor'), 'light'),
      hairStyle: params.get('top') || 'shortFlat',
      hairColor: findColorIdByHex(HAIR_COLORS, params.get('hairColor'), 'brown'),
      accessory: params.get('accessoriesProbability') === '0' ? 'none' : (params.get('accessories') || 'none'),
      clothing: params.get('clothing') || 'hoodie',
      clothingColor: findColorIdByHex(CLOTHING_COLORS, params.get('clothesColor'), 'blue'),
      facialHair: params.get('facialHairProbability') === '0' ? 'none' : (params.get('facialHair') || 'none'),
      expression: params.get('mouth') || 'smile',
      background: params.get('backgroundColor') || 'transparent',
    };
  } catch {
    return null;
  }
}

export function AvatarCustomizer({ isOpen, onClose, onSelect, currentAvatar }: AvatarCustomizerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('style');
  const [style, setStyle] = useState('avataaars');
  const [skinColor, setSkinColor] = useState('light');
  const [hairStyle, setHairStyle] = useState('shortFlat');
  const [hairColor, setHairColor] = useState('brown');
  const [accessory, setAccessory] = useState('none');
  const [clothing, setClothing] = useState('hoodie');
  const [clothingColor, setClothingColor] = useState('blue');
  const [facialHair, setFacialHair] = useState('none');
  const [expression, setExpression] = useState('smile');
  const [background, setBackground] = useState('transparent');
  const [seed, setSeed] = useState(() => Math.random().toString(36).substring(7));

  useEffect(() => {
    if (!isOpen) return;
    const parsedAvatar = parseCurrentAvatar(currentAvatar);
    if (!parsedAvatar) return;

    setStyle(parsedAvatar.style);
    setSeed(parsedAvatar.seed);
    setSkinColor(parsedAvatar.skinColor);
    setHairStyle(parsedAvatar.hairStyle);
    setHairColor(parsedAvatar.hairColor);
    setAccessory(parsedAvatar.accessory);
    setClothing(parsedAvatar.clothing);
    setClothingColor(parsedAvatar.clothingColor);
    setFacialHair(parsedAvatar.facialHair);
    setExpression(parsedAvatar.expression);
    setBackground(parsedAvatar.background);
  }, [currentAvatar, isOpen]);

  const avatarUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('seed', `${seed}_${skinColor}_${hairStyle}_${hairColor}_${accessory}_${clothing}_${clothingColor}_${facialHair}_${expression}`);

    if (background !== 'transparent') {
      params.set('backgroundColor', background);
    }

    if (style === 'avataaars') {
      params.set('top', hairStyle);
      params.set('hairColor', normalizeHex(HAIR_COLORS.find((hair) => hair.id === hairColor)?.hex || '#2C1B18'));
      params.set('skinColor', normalizeHex(SKIN_COLORS.find((skin) => skin.id === skinColor)?.hex || '#FFDBB4'));
      if (accessory !== 'none') {
        params.set('accessories', accessory);
        params.set('accessoriesProbability', '100');
      } else {
        params.set('accessoriesProbability', '0');
      }
      params.set('clothing', clothing);
      params.set('clothesColor', normalizeHex(CLOTHING_COLORS.find((entry) => entry.id === clothingColor)?.hex || '#3B82F6'));
      if (facialHair !== 'none') {
        params.set('facialHair', facialHair);
        params.set('facialHairProbability', '100');
      } else {
        params.set('facialHairProbability', '0');
      }
      params.set('mouth', expression);
    }

    return `https://api.dicebear.com/7.x/${style}/svg?${params.toString()}`;
  }, [accessory, background, clothing, clothingColor, expression, facialHair, hairColor, hairStyle, seed, skinColor, style]);

  const randomize = () => {
    setSeed(Math.random().toString(36).substring(7));
    setSkinColor(SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)].id);
    setHairStyle(HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)]);
    setHairColor(HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].id);
    setAccessory(ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)].id);
    setClothing(CLOTHING[Math.floor(Math.random() * CLOTHING.length)].id);
    setClothingColor(CLOTHING_COLORS[Math.floor(Math.random() * CLOTHING_COLORS.length)].id);
    setFacialHair(FACIAL_HAIR[Math.floor(Math.random() * FACIAL_HAIR.length)].id);
    setExpression(EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)].id);
    setBackground(BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)].id);
  };

  const tabIndex = TABS.findIndex((tab) => tab.id === activeTab);
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900"
        >
          <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
            <button onClick={onClose} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-5 w-5 dark:text-white" />
            </button>
            <h2 className="text-lg font-bold dark:text-white">Customize Avatar</h2>
            <Button
              onClick={() => {
                onSelect(avatarUrl);
                onClose();
              }}
              className="rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-1.5 text-sm text-white"
            >
              <Check className="mr-1 inline h-4 w-4" />
              Save
            </Button>
          </div>

          <div className="flex flex-col items-center bg-gradient-to-b from-gray-50 to-white p-6 dark:from-gray-800 dark:to-gray-900">
            <motion.div
              key={avatarUrl}
              initial={{ scale: 0.86, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            >
              <div
                className="h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-xl dark:border-gray-700"
                style={background !== 'transparent' ? { backgroundColor: BACKGROUNDS.find((entry) => entry.id === background)?.hex } : undefined}
              >
                <img src={avatarUrl} alt="Avatar preview" className="h-full w-full object-cover" />
              </div>
            </motion.div>
            <button
              onClick={randomize}
              className="mt-3 flex items-center gap-1.5 text-sm font-medium text-purple-500 transition-colors hover:text-purple-600"
            >
              <Shuffle className="h-4 w-4" />
              <span>Randomize</span>
            </button>
          </div>

          <div className="flex items-center border-y border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            <button
              onClick={() => setActiveTab(TABS[Math.max(0, tabIndex - 1)].id)}
              disabled={tabIndex === 0}
              className="p-2 hover:bg-gray-200 disabled:opacity-30 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4 dark:text-white" />
            </button>
            <div className="no-scrollbar flex-1 overflow-x-auto">
              <div className="flex space-x-1 px-1 py-2">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setActiveTab(TABS[Math.min(TABS.length - 1, tabIndex + 1)].id)}
              disabled={tabIndex === TABS.length - 1}
              className="p-2 hover:bg-gray-200 disabled:opacity-30 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4 dark:text-white" />
            </button>
          </div>

          <div className="min-h-[200px] max-h-[300px] flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === 'style' && (
                  <div className="grid grid-cols-3 gap-2">
                    {AVATAR_STYLES.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => {
                          setStyle(entry.id);
                          setSeed(Math.random().toString(36).substring(7));
                        }}
                        className={`rounded-xl border-2 p-3 text-center transition-all ${
                          style === entry.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                        }`}
                      >
                        <img
                          src={`https://api.dicebear.com/7.x/${entry.id}/svg?seed=preview_${entry.id}`}
                          alt={entry.label}
                          className="mx-auto mb-1 h-12 w-12 rounded-full"
                        />
                        <span className="block truncate text-[10px] font-medium dark:text-gray-300">{entry.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'skin' && (
                  <div className="grid grid-cols-3 gap-3">
                    {SKIN_COLORS.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => setSkinColor(entry.id)}
                        className={`flex items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                          skinColor === entry.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="h-8 w-8 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: entry.hex }} />
                        <span className="text-xs font-medium dark:text-gray-300">{entry.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'hair' && (
                  <div className="grid grid-cols-2 gap-2">
                    {HAIR_STYLES.map((entry) => (
                      <button
                        key={entry}
                        onClick={() => setHairStyle(entry)}
                        className={`rounded-xl border-2 p-3 text-left transition-all ${
                          hairStyle === entry ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <span className="text-sm font-medium capitalize dark:text-gray-300">{humanize(entry)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'hairColor' && (
                  <div className="grid grid-cols-5 gap-3">
                    {HAIR_COLORS.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => setHairColor(entry.id)}
                        className={`flex flex-col items-center rounded-xl border-2 p-2 transition-all ${
                          hairColor === entry.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="h-10 w-10 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: entry.hex }} />
                        <span className="mt-1 text-[10px] font-medium capitalize dark:text-gray-300">{entry.id}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'accessories' && (
                  <div className="grid grid-cols-2 gap-2">
                    {ACCESSORIES.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => setAccessory(entry.id)}
                        className={`rounded-xl border-2 p-3 text-left transition-all ${
                          accessory === entry.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <span className="text-sm font-medium dark:text-gray-300">{entry.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'clothing' && (
                  <div className="grid grid-cols-2 gap-2">
                    {CLOTHING.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => setClothing(entry.id)}
                        className={`rounded-xl border-2 p-3 text-left transition-all ${
                          clothing === entry.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <span className="text-sm font-medium dark:text-gray-300">{entry.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'clothingColor' && (
                  <div className="grid grid-cols-5 gap-3">
                    {CLOTHING_COLORS.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => setClothingColor(entry.id)}
                        className={`flex flex-col items-center rounded-xl border-2 p-2 transition-all ${
                          clothingColor === entry.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="h-10 w-10 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: entry.hex }} />
                        <span className="mt-1 text-[10px] font-medium capitalize dark:text-gray-300">{entry.id}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'facialHair' && (
                  <div className="grid grid-cols-2 gap-2">
                    {FACIAL_HAIR.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => setFacialHair(entry.id)}
                        className={`rounded-xl border-2 p-3 text-left transition-all ${
                          facialHair === entry.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <span className="text-sm font-medium dark:text-gray-300">{entry.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'expression' && (
                  <div className="grid grid-cols-2 gap-2">
                    {EXPRESSIONS.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => setExpression(entry.id)}
                        className={`rounded-xl border-2 p-3 text-left transition-all ${
                          expression === entry.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <span className="text-sm font-medium dark:text-gray-300">{entry.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'background' && (
                  <div className="grid grid-cols-5 gap-3">
                    {BACKGROUNDS.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => setBackground(entry.id)}
                        className={`flex flex-col items-center rounded-xl border-2 p-2 transition-all ${
                          background === entry.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: entry.hex === 'transparent' ? '#f3f4f6' : entry.hex }}
                        >
                          {entry.hex === 'transparent' ? <X className="h-5 w-5 text-gray-400" /> : null}
                        </div>
                        <span className="mt-1 text-[10px] font-medium dark:text-gray-300">{entry.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="border-t border-gray-200 p-4 dark:border-gray-700">
            <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Quick Picks</p>
            <div className="no-scrollbar flex space-x-2 overflow-x-auto pb-1">
              {AVATAR_STYLES.slice(0, 8).flatMap((entry) =>
                Array.from({ length: 3 }, (_, index) => {
                  const previewUrl = `https://api.dicebear.com/7.x/${entry.id}/svg?seed=quick_${entry.id}_${index}`;
                  return (
                    <motion.img
                      key={`${entry.id}_${index}`}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.92 }}
                      src={previewUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 cursor-pointer rounded-full border-2 border-gray-200 transition-colors hover:border-blue-400 dark:border-gray-600"
                      onClick={() => {
                        onSelect(previewUrl);
                        onClose();
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
