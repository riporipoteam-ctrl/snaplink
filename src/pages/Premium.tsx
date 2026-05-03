import React, { useState } from 'react';
import { doc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Crown, Star, CheckCircle, Sparkles, Zap, Palette, Edit3, Shield, Video, Tag } from 'lucide-react';
import { motion } from 'motion/react';

const DISCOUNT_CODES: Record<string, number> = {
  'RIPOTEAM2026': 0.50,
};

export function Premium() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [codeApplied, setCodeApplied] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [codeDiscount, setCodeDiscount] = useState(0);

  const PRICE = 5600;
  const WEEKEND_DISCOUNT = 0.15;
  const dayOfWeek = new Date().getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isDiscountActive = isWeekend || codeApplied;
  const totalDiscount = Math.min((isWeekend ? WEEKEND_DISCOUNT : 0) + codeDiscount, 0.70);
  const finalPrice = totalDiscount > 0 ? Math.round(PRICE * (1 - totalDiscount)) : PRICE;

  const applyCode = () => {
    const code = discountCode.trim().toUpperCase();
    if (DISCOUNT_CODES[code]) {
      setCodeDiscount(DISCOUNT_CODES[code]);
      setCodeApplied(true);
      setCodeError('');
    } else {
      setCodeError('Invalid discount code');
      setCodeDiscount(0);
      setCodeApplied(false);
    }
  };

  const handleSubscribe = async () => {
    if (!userProfile) return;
    if (userProfile.snapCoins < finalPrice) {
      alert(`You need ${finalPrice} SnapCoins to subscribe!`);
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', userProfile.uid);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      await updateDoc(userRef, {
        snapCoins: increment(-finalPrice),
        premiumUntil: nextMonth.toISOString(),
        isPremium: true,
        badges: arrayUnion({ id: 'premium', name: 'SnapLink Plus', imageURL: '⭐' }),
      });
      alert('Welcome to SnapLink Plus! Your Plus badge is now active.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userProfile.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const isPremium = userProfile?.isPremium || (userProfile?.premiumUntil && new Date(userProfile.premiumUntil) > new Date());

  const features = [
    { icon: Shield, label: 'Plus Profile Badge', desc: 'Stand out with a gold star badge' },
    { icon: Palette, label: 'Exclusive Profile Themes', desc: 'Access premium-only decorations' },
    { icon: Video, label: 'Longer Video Uploads', desc: 'Upload videos up to 10 minutes' },
    { icon: Edit3, label: 'Edit Posts', desc: 'Edit your posts after publishing' },
    { icon: Zap, label: 'Priority Support', desc: 'Get faster responses from our team' },
    { icon: Sparkles, label: 'Early Access Features', desc: 'Try new features before everyone else' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-20 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-4">
        <h1 className="text-xl font-bold flex items-center dark:text-white"><Crown className="mr-2 text-yellow-500" /> SnapLink Plus</h1>
      </div>

      <div className="px-4 pt-8 pb-12">
        {/* Hero */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="inline-block"
          >
            <div className="relative mx-auto w-24 h-24 mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-2xl rotate-6 opacity-30 blur-lg" />
              <div className="relative bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center w-24 h-24 shadow-xl">
                <Crown className="h-12 w-12 text-white" />
              </div>
            </div>
          </motion.div>
          <h2 className="text-3xl font-extrabold dark:text-white mb-3">SnapLink Plus</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">Stand out from the crowd. Get exclusive features, the Plus badge, and more.</p>
        </div>

        {isPremium ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-yellow-400 to-amber-500 rounded-2xl p-6 text-center text-white shadow-xl mb-8"
          >
            <CheckCircle className="h-12 w-12 mx-auto mb-3 drop-shadow-md" />
            <h3 className="text-xl font-bold mb-1">You are Plus!</h3>
            <p className="text-white/80 text-sm">Active until {new Date(userProfile!.premiumUntil!).toLocaleDateString()}</p>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm"
          >
            <div className="flex justify-center items-end space-x-2 mb-3">
              <span className="text-5xl font-extrabold bg-gradient-to-r from-yellow-500 to-amber-500 bg-clip-text text-transparent">{finalPrice.toLocaleString()}</span>
              <span className="text-gray-500 dark:text-gray-400 pb-2 flex items-center"><Star className="h-4 w-4 text-yellow-500 mr-1 fill-yellow-500" /> Coins / mo</span>
            </div>
            {isDiscountActive && (
              <div className="text-center mb-4">
                <span className="inline-block bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs px-3 py-1 rounded-full font-bold">
                  🎉 {Math.round(totalDiscount * 100)}% OFF — Save {(PRICE - finalPrice).toLocaleString()} Coins!
                </span>
                {isWeekend && <p className="text-xs text-gray-400 mt-1">Weekend discount active!</p>}
                {codeApplied && <p className="text-xs text-green-500 mt-1">Discount code applied!</p>}
              </div>
            )}

            {/* Discount Code */}
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter discount code"
                  value={discountCode}
                  onChange={(e) => { setDiscountCode(e.target.value); setCodeError(''); }}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <Button
                variant="outline"
                className="rounded-xl px-4 font-bold text-sm"
                onClick={applyCode}
                disabled={!discountCode.trim() || codeApplied}
              >
                {codeApplied ? '✓ Applied' : 'Apply'}
              </Button>
            </div>
            {codeError && <p className="text-red-500 text-xs mb-3 -mt-2">{codeError}</p>}
            
            <Button 
              className="w-full h-14 text-lg bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white shadow-lg hover:shadow-xl transition-all font-bold rounded-xl"
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Subscribe Now'}
            </Button>
          </motion.div>
        )}

        {/* Features Grid */}
        <h3 className="font-bold text-lg dark:text-white mb-4">What's included</h3>
        <div className="grid grid-cols-1 gap-3">
          {features.map((feature, idx) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="flex items-start space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700"
            >
              <div className="bg-gradient-to-br from-yellow-400 to-amber-500 p-2.5 rounded-xl text-white shrink-0 shadow-sm">
                <feature.icon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm dark:text-white">{feature.label}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
