import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Target, CheckCircle, Clock, Calendar, Star, Zap } from 'lucide-react';
import { Challenge, getUserChallenges } from '../lib/challenges';
import { motion } from 'motion/react';
import { awardUserProgress, normalizeUserProgress } from '../lib/levels';
import { LevelBadge } from '../components/ui/LevelBadge';
import { useSnapLinkEvents } from '../contexts/EventContext';

export function Challenges() {
  const { userProfile } = useAuth();
  const { activeEvent } = useSnapLinkEvents();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile) return;

    const fetchChallenges = async () => {
      try {
        const currentChallenges = await getUserChallenges(userProfile.uid);
        setChallenges(currentChallenges);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'user_challenges');
      } finally {
        setLoading(false);
      }
    };

    fetchChallenges();
  }, [userProfile]);

  const claimReward = async (challengeId: string) => {
    if (!userProfile) return;
    
    try {
      const challenge = challenges.find(c => c.id === challengeId);
      if (!challenge || challenge.completed || challenge.progress < challenge.target) return;

      const today = new Date().toISOString().split('T')[0];
      const challengeRef = doc(db, 'user_challenges', `${userProfile.uid}_${today}`);
      
      const updatedChallenges = challenges.map(c => 
        c.id === challengeId ? { ...c, completed: true } : c
      );

      await updateDoc(challengeRef, { challenges: updatedChallenges });
      await awardUserProgress(userProfile.uid, {
        snapCoins: challenge.rewards.coins || 0,
        xp: challenge.rewards.xp || 0,
      });
      
      setChallenges(updatedChallenges);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'user_challenges');
    }
  };

  if (loading) return (
    <div className="p-8 text-center dark:bg-gray-900 min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
    </div>
  );

  const completedCount = challenges.filter(c => c.completed).length;
  const totalCount = challenges.length;
  const levelProgress = normalizeUserProgress(userProfile);

  return (
    <div className="pb-20 md:pb-0 min-h-screen bg-white dark:bg-gray-900">
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <h1 className="text-xl font-bold flex items-center dark:text-white"><Target className="mr-2 text-blue-500" /> Challenges</h1>
      </div>

      <div className="p-4">
        {activeEvent && (
          <div className={`mb-5 rounded-2xl border px-5 py-4 ${activeEvent.themeKey === 'world-cup' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200' : activeEvent.themeKey === 'doomsday' ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200' : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200'}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] opacity-70">Active event boost</div>
                <div className="mt-1 text-sm font-semibold">{activeEvent.title} is live, so your challenge steps, XP, and SnapCoins are boosted right now.</div>
              </div>
              <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-sm dark:bg-black/20">
                {activeEvent.challengeMultiplier}x steps · {activeEvent.xpMultiplier}x XP · {activeEvent.coinMultiplier}x coins
              </div>
            </div>
          </div>
        )}

        {/* Hero Card */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 mb-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">Earn rewards every day</h2>
                <p className="text-white/70 text-sm mt-1">Challenges now drop XP, SnapCoins, and level-up gift boxes.</p>
              </div>
              <div className="flex items-center gap-2">
                <LevelBadge level={levelProgress.level} className="border-white/20 bg-white/15 text-white" />
                <div className="flex items-center space-x-1 bg-white/20 rounded-full px-3 py-1.5 font-bold text-sm">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span>{userProfile?.snapCoins || 0}</span>
                </div>
              </div>
            </div>
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-white/80">Level progress</span>
                <span className="font-bold text-white">{levelProgress.xp} / {levelProgress.xpForNextLevel || 0} XP</span>
              </div>
              <div className="mt-2 h-2.5 rounded-full bg-white/15">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(levelProgress.progressRatio, 0.04) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-2.5 rounded-full bg-white"
                />
              </div>
            </div>
            {/* Progress */}
            <div className="bg-white/20 rounded-full h-2.5 mb-2">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="bg-white h-2.5 rounded-full"
              />
            </div>
            <p className="text-sm text-white/70">{completedCount}/{totalCount} completed today</p>
          </div>
        </div>

        {/* Daily Challenges */}
        <h3 className="font-bold text-lg mb-4 flex items-center dark:text-white">
          <Clock className="mr-2 h-5 w-5 text-blue-500" /> Daily Rotation
        </h3>
        <div className="space-y-3 mb-8">
          {challenges.filter(c => c.type === 'daily').map((challenge, idx) => (
            <motion.div 
              key={challenge.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-white dark:bg-gray-800 border ${challenge.completed ? 'border-green-200 dark:border-green-800/50' : 'border-gray-200 dark:border-gray-700'} rounded-2xl p-4 flex items-center justify-between shadow-sm`}
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-bold dark:text-white text-sm">{challenge.title}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{challenge.description}</p>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[200px]">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (challenge.progress / challenge.target) * 100)}%` }}
                      className={`h-2 rounded-full ${challenge.completed ? 'bg-green-500' : 'bg-blue-500'}`}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{challenge.progress} / {challenge.target}</p>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-2 ml-4 shrink-0">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {(challenge.rewards.coins || 0) > 0 && (
                    <span className="font-bold text-yellow-500 flex items-center text-sm">
                      <Star className="h-3.5 w-3.5 fill-yellow-500 mr-1" />
                      +{challenge.rewards.coins}
                    </span>
                  )}
                  {(challenge.rewards.xp || 0) > 0 && (
                    <span className="font-bold text-blue-500 flex items-center text-sm">
                      <Zap className="h-3.5 w-3.5 mr-1" />
                      +{challenge.rewards.xp} XP
                    </span>
                  )}
                </div>
                {challenge.completed ? (
                  <span className="flex items-center text-green-500 font-bold text-xs"><CheckCircle className="h-4 w-4 mr-1" /> Claimed</span>
                ) : (
                  <Button 
                    size="sm" 
                    disabled={challenge.progress < challenge.target}
                    onClick={() => claimReward(challenge.id)}
                    className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4"
                  >
                    Claim
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Weekend Challenges */}
        {challenges.some(c => c.type === 'weekly') && (
          <>
            <h3 className="font-bold text-lg mb-4 flex items-center text-purple-600 dark:text-purple-400">
              <Calendar className="mr-2 h-5 w-5" /> Weekend Specials
            </h3>
            <div className="space-y-3">
              {challenges.filter(c => c.type === 'weekly').map((challenge, idx) => (
                <motion.div 
                  key={challenge.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`bg-purple-50 dark:bg-purple-900/10 border ${challenge.completed ? 'border-green-200 dark:border-green-800/50' : 'border-purple-200 dark:border-purple-800/50'} rounded-2xl p-4 flex items-center justify-between`}
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-purple-900 dark:text-purple-300 text-sm">{challenge.title}</h4>
                    <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">{challenge.description}</p>
                    <div className="mt-2">
                      <div className="w-full bg-purple-200 dark:bg-purple-800/50 rounded-full h-2 max-w-[200px]">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (challenge.progress / challenge.target) * 100)}%` }}
                          className={`h-2 rounded-full ${challenge.completed ? 'bg-green-500' : 'bg-purple-500'}`}
                        />
                      </div>
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">{challenge.progress} / {challenge.target}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2 ml-4 shrink-0">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {(challenge.rewards.coins || 0) > 0 && (
                        <span className="font-bold text-yellow-500 flex items-center text-sm">
                          <Star className="h-3.5 w-3.5 fill-yellow-500 mr-1" />
                          +{challenge.rewards.coins}
                        </span>
                      )}
                      {(challenge.rewards.xp || 0) > 0 && (
                        <span className="font-bold text-purple-600 dark:text-purple-300 flex items-center text-sm">
                          <Zap className="h-3.5 w-3.5 mr-1" />
                          +{challenge.rewards.xp} XP
                        </span>
                      )}
                    </div>
                    {challenge.completed ? (
                      <span className="flex items-center text-green-500 font-bold text-xs"><CheckCircle className="h-4 w-4 mr-1" /> Claimed</span>
                    ) : (
                      <Button 
                        size="sm" 
                        disabled={challenge.progress < challenge.target}
                        onClick={() => claimReward(challenge.id)}
                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-4"
                      >
                        Claim
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
