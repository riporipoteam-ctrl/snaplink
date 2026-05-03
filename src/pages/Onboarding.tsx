import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { Logo } from '../components/ui/Logo';
import { Camera, Upload, User, Smile, Bot, Palette, Gamepad2, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { sanitizeStorageFileName, uploadOptimizedImage } from '../lib/storageUploads';

// Avatar categories with DiceBear styles
const AVATAR_CATEGORIES = [
  { 
    id: 'people',
    label: 'People', 
    icon: User,
    style: 'avataaars',
    seeds: Array.from({ length: 12 }, (_, i) => `person_${i + 100}`)
  },
  {
    id: 'fun',
    label: 'Fun',
    icon: Smile,
    style: 'fun-emoji',
    seeds: Array.from({ length: 12 }, (_, i) => `fun_${i + 200}`)
  },
  {
    id: 'robots',
    label: 'Robots',
    icon: Bot,
    style: 'bottts',
    seeds: Array.from({ length: 12 }, (_, i) => `robot_${i + 300}`)
  },
  {
    id: 'pixel',
    label: 'Pixel',
    icon: Gamepad2,
    style: 'pixel-art',
    seeds: Array.from({ length: 12 }, (_, i) => `pixel_${i + 400}`)
  },
  {
    id: 'art',
    label: 'Art',
    icon: Palette,
    style: 'lorelei',
    seeds: Array.from({ length: 12 }, (_, i) => `art_${i + 500}`)
  },
  {
    id: 'adventure',
    label: 'Adventure',
    icon: Sparkles,
    style: 'adventurer',
    seeds: Array.from({ length: 12 }, (_, i) => `adv_${i + 600}`)
  }
];

function getAvatarUrl(style: string, seed: string) {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
}

export function Onboarding() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: avatar, 2: details
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState(currentUser?.photoURL || getAvatarUrl('avataaars', 'person_100'));
  const [selectedCategory, setSelectedCategory] = useState('people');
  const [isCustomPhoto, setIsCustomPhoto] = useState(false);
  const [customPhotoFile, setCustomPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (userProfile) {
      navigate('/', { replace: true });
    }
  }, [userProfile, navigate]);

  const handleSelectAvatar = (url: string) => {
    setPhotoURL(url);
    setIsCustomPhoto(false);
    setCustomPhotoFile(null);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCustomPhotoFile(file);
    setIsCustomPhoto(true);

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoURL(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    if (username.length < 3 || username.length > 30) {
      setError('Username must be between 3 and 30 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let finalPhotoURL = photoURL;

      // If user uploaded a custom photo, save it through the shared upload helper
      if (isCustomPhoto && customPhotoFile) {
        const uploadedPhoto = await uploadOptimizedImage(
          customPhotoFile,
          `avatars/${currentUser.uid}/${Date.now()}-${sanitizeStorageFileName(customPhotoFile.name || 'avatar.jpg')}`,
          {
            maxWidth: 400,
            maxHeight: 400,
            quality: 0.84,
            allowDataUrlFallback: true,
            preferDataUrl: true,
          }
        );
        finalPhotoURL = uploadedPhoto.url;
      }

      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        uid: currentUser.uid,
        username: username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
        displayName,
        bio,
        photoURL: finalPhotoURL,
        bannerURL: 'https://picsum.photos/seed/snaplink/800/200',
        createdAt: new Date().toISOString(),
        followersCount: 0,
        followingCount: 0,
        role: currentUser.email === 'ripo.ripoteam@gmail.com' ? 'admin' : 'user',
        isBanned: false,
        isVerified: false,
        snapCoins: 100,
        level: 1,
        xp: 0,
        totalXp: 0,
        activityStatus: 'online',
        actualPresenceStatus: 'online',
        statusSetAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        notificationsEnabled: false,
        blockedUserIds: [],
        notificationPermission: 'default',
        unlockedDecorations: []
      });
      navigate('/');
    } catch (err) {
      console.error('Error creating profile:', err);
      setError('Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentCategory = AVATAR_CATEGORIES.find(c => c.id === selectedCategory) || AVATAR_CATEGORIES[0];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4 py-8 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl" />

      <div className="w-full max-w-lg relative z-10">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Logo className="h-12 w-12 mx-auto mb-4" />
          <h2 className="text-3xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            {step === 1 ? 'Choose your look' : 'Almost done!'}
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400 font-medium">
            {step === 1 ? 'Pick an avatar or upload your photo' : 'Set your username and bio'}
          </p>
          
          {/* Step indicator */}
          <div className="flex justify-center mt-4 space-x-2">
            <div className={`h-2 rounded-full transition-all duration-300 ${step === 1 ? 'w-8 bg-blue-500' : 'w-2 bg-gray-300 dark:bg-gray-600'}`} />
            <div className={`h-2 rounded-full transition-all duration-300 ${step === 2 ? 'w-8 bg-blue-500' : 'w-2 bg-gray-300 dark:bg-gray-600'}`} />
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6 space-y-6"
            >
              {/* Selected avatar preview */}
              <div className="flex flex-col items-center">
                <motion.div
                  key={photoURL}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="relative group"
                >
                  <div className="h-28 w-28 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 p-1 shadow-lg shadow-purple-500/20">
                    <div className="h-full w-full rounded-full overflow-hidden bg-white dark:bg-gray-800">
                      <img src={photoURL} alt="Selected avatar" className="h-full w-full object-cover" />
                    </div>
                  </div>
                  {/* Upload photo button overlay */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2.5 bg-blue-500 hover:bg-blue-600 rounded-full text-white shadow-lg transition-transform hover:scale-110"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </motion.div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                {isCustomPhoto && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm font-medium text-blue-500 mt-2"
                  >
                    Custom photo selected ✓
                  </motion.p>
                )}
              </div>

              {/* Category tabs */}
              <div className="flex overflow-x-auto space-x-1 pb-1 no-scrollbar">
                {AVATAR_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center space-x-2 px-4 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
                        selectedCategory === cat.id
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md shadow-purple-500/20'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Avatar grid */}
              <div className="grid grid-cols-4 gap-3">
                {currentCategory.seeds.map((seed, idx) => {
                  const url = getAvatarUrl(currentCategory.style, seed);
                  const isSelected = photoURL === url;
                  return (
                    <motion.button
                      key={seed}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.03, type: 'spring', stiffness: 200 }}
                      whileHover={{ scale: 1.1, y: -4 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleSelectAvatar(url)}
                      className={`relative aspect-square rounded-2xl overflow-hidden border-3 transition-all ${
                        isSelected
                          ? 'border-blue-500 shadow-lg shadow-blue-500/30 ring-4 ring-blue-500/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-500'
                      }`}
                    >
                      <img src={url} alt={`Avatar ${idx}`} className="h-full w-full object-cover bg-gray-100 dark:bg-gray-700 p-1" />
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute inset-0 bg-blue-500/20 flex items-center justify-center"
                        >
                          <div className="bg-blue-500 rounded-full p-1">
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          </div>
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Upload custom photo button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 font-medium hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center space-x-2"
              >
                <Upload className="h-5 w-5" />
                <span>Upload your own photo</span>
              </button>

              <Button
                onClick={() => setStep(2)}
                className="w-full h-13 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-purple-500/20"
              >
                Continue
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6"
            >
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-xl font-medium"
                  >
                    {error}
                  </motion.p>
                )}

                {/* Preview */}
                <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
                  <div className="h-16 w-16 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-purple-400 p-0.5 shrink-0">
                    <img src={photoURL} alt="Avatar" className="h-full w-full rounded-full object-cover bg-white dark:bg-gray-800" />
                  </div>
                  <div>
                    <p className="font-bold text-lg dark:text-white">{displayName || 'Your Name'}</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">@{username || 'username'}</p>
                  </div>
                  <button type="button" onClick={() => setStep(1)} className="ml-auto text-sm text-blue-500 font-bold hover:text-blue-600">
                    Change
                  </button>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Username *</label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. johndoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Only lowercase letters, numbers, and underscores</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Display Name *</label>
                  <Input
                    type="text"
                    required
                    placeholder="Your Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Bio</label>
                  <textarea
                    rows={3}
                    className="flex w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent dark:bg-gray-900 px-4 py-3 text-sm placeholder:text-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white resize-none"
                    placeholder="Tell people about yourself..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={160}
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{bio.length}/160</p>
                </div>

                <div className="flex space-x-3 pt-2">
                  <Button 
                    type="button" 
                    onClick={() => setStep(1)} 
                    className="flex-1 h-13 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border-0 rounded-xl"
                  >
                    <ChevronLeft className="h-5 w-5 mr-1" /> Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-2 h-13 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-purple-500/20 border-0" 
                    disabled={loading || !username || !displayName}
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Creating...</span>
                      </div>
                    ) : (
                      'Complete Setup ✦'
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
