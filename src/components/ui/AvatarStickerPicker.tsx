import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Smile } from 'lucide-react';

const STICKER_MOODS = [
  { id: 'happy', label: '😄 Happy', seeds: ['happy_wave', 'happy_jump', 'happy_dance', 'happy_heart', 'happy_star', 'happy_sun'] },
  { id: 'cool', label: '😎 Cool', seeds: ['cool_shades', 'cool_peace', 'cool_thumbs', 'cool_fire', 'cool_yes', 'cool_rockstar'] },
  { id: 'sad', label: '😢 Sad', seeds: ['sad_cry', 'sad_rain', 'sad_sorry', 'sad_hug', 'sad_tears', 'sad_heart'] },
  { id: 'angry', label: '😤 Angry', seeds: ['angry_fire', 'angry_fist', 'angry_boom', 'angry_no', 'angry_grr', 'angry_stomp'] },
  { id: 'love', label: '❤️ Love', seeds: ['love_heart', 'love_kiss', 'love_hug', 'love_blush', 'love_cupid', 'love_roses'] },
  { id: 'silly', label: '🤪 Silly', seeds: ['silly_tongue', 'silly_dizzy', 'silly_clown', 'silly_wink', 'silly_laugh', 'silly_party'] },
  { id: 'think', label: '🤔 Thinking', seeds: ['think_hmm', 'think_wonder', 'think_smart', 'think_idea', 'think_eureka', 'think_puzzle'] },
  { id: 'sleepy', label: '😴 Sleepy', seeds: ['sleepy_zzz', 'sleepy_yawn', 'sleepy_moon', 'sleepy_bed', 'sleepy_lazy', 'sleepy_night'] },
];

const STICKER_STYLES = [
  { id: 'avataaars', label: '👤' },
  { id: 'fun-emoji', label: '😀' },
  { id: 'bottts', label: '🤖' },
  { id: 'lorelei', label: '🧝' },
  { id: 'adventurer', label: '🗡️' },
  { id: 'pixel-art', label: '👾' },
];

interface AvatarStickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (stickerUrl: string) => void;
  userSeed?: string;
  userPhotoURL?: string;
}

export function AvatarStickerPicker({ isOpen, onClose, onSelect, userSeed = 'default', userPhotoURL }: AvatarStickerPickerProps) {
  // Extract style and seed from user's DiceBear photoURL if available
  const parsedAvatar = React.useMemo(() => {
    if (userPhotoURL) {
      const match = userPhotoURL.match(/dicebear\.com\/[\d.x]+\/([^/]+)\/svg\?seed=([^&]*)/);
      if (match) return { style: match[1], seed: match[2] };
    }
    return null;
  }, [userPhotoURL]);

  const [activeMood, setActiveMood] = useState('happy');
  const [activeStyle, setActiveStyle] = useState(parsedAvatar?.style || 'fun-emoji');

  const generateStickerUrl = (style: string, seed: string) => {
    const baseSeed = parsedAvatar?.seed || userSeed;
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${baseSeed}_${seed}&backgroundColor=transparent&scale=90&size=128`;
  };

  const currentMood = STICKER_MOODS.find(m => m.id === activeMood) || STICKER_MOODS[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <Smile className="h-4 w-4 text-purple-500" />
              <span className="font-bold text-sm dark:text-white">Avatar Stickers</span>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          {/* Style tabs */}
          <div className="flex space-x-1 px-3 pt-2">
            {STICKER_STYLES.map(style => (
              <button
                key={style.id}
                onClick={() => setActiveStyle(style.id)}
                className={`px-2 py-1 rounded-full text-sm transition-colors ${
                  activeStyle === style.id
                    ? 'bg-purple-100 dark:bg-purple-900/30'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>

          {/* Mood tabs */}
          <div className="flex overflow-x-auto space-x-1 px-3 py-2 scrollbar-none">
            {STICKER_MOODS.map(mood => (
              <button
                key={mood.id}
                onClick={() => setActiveMood(mood.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeMood === mood.id
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {mood.label}
              </button>
            ))}
          </div>

          {/* Sticker grid */}
          <div className="grid grid-cols-3 gap-2 p-3 max-h-48 overflow-y-auto">
            {currentMood.seeds.map((seed) => {
              const url = generateStickerUrl(activeStyle, seed);
              return (
                <motion.button
                  key={seed}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { onSelect(url); onClose(); }}
                  className="aspect-square rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/20 p-2 transition-colors"
                >
                  <img
                    src={url}
                    alt={seed}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
