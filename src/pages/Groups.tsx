import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Users, Plus, Search, X, ArrowRight, Globe, Lock, Sparkles, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_GROUP_BADGE, DEFAULT_GROUP_THEME_ID, GROUP_THEME_OPTIONS, getGroupTheme } from '../lib/groupThemes';

const CATEGORIES = ['General', 'Gaming', 'Music', 'Tech', 'Art', 'Sports', 'Education', 'Memes', 'Other'];

export function Groups() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupPrivacy, setNewGroupPrivacy] = useState<'public' | 'private'>('public');
  const [newGroupCategory, setNewGroupCategory] = useState('General');
  const [newGroupThemeId, setNewGroupThemeId] = useState(DEFAULT_GROUP_THEME_ID);
  const [newGroupBadgeEmoji, setNewGroupBadgeEmoji] = useState(DEFAULT_GROUP_BADGE);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      setLoading(false);
      try { handleFirestoreError(error, OperationType.LIST, 'groups'); } catch(e) {}
    });
    return () => unsubscribe();
  }, []);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !userProfile || isCreatingGroup) return;
    setIsCreatingGroup(true);
    try {
      const groupRef = doc(collection(db, 'groups'));
      await setDoc(groupRef, {
        id: groupRef.id,
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        privacy: newGroupPrivacy,
        category: newGroupCategory,
        creatorId: userProfile.uid,
        admins: [userProfile.uid],
        moderators: [],
        members: [userProfile.uid],
        membersCount: 1,
        themeId: newGroupThemeId,
        badgeEmoji: Array.from(newGroupBadgeEmoji.trim()).slice(0, 2).join('') || DEFAULT_GROUP_BADGE,
        modsCanAnnounce: true,
        modsCanManageRequests: false,
        allowMemberPosts: true,
        allowMemberChat: true,
        welcomeMessage: `Welcome to ${newGroupName.trim()}! Check the rules, say hi, and jump in.`,
        rules: [
          'Be respectful to everyone in the group.',
          'Keep posts and chat on topic.',
          'No spam, scams, or repeated invites.',
        ],
        createdAt: new Date().toISOString(),
      });
      setIsCreating(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupPrivacy('public');
      setNewGroupCategory('General');
      setNewGroupThemeId(DEFAULT_GROUP_THEME_ID);
      setNewGroupBadgeEmoji(DEFAULT_GROUP_BADGE);
      navigate(`/group/${groupRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'groups');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const filteredGroups = groups.filter(g => {
    const matchesSearch = g.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'mine' && g.members?.includes(userProfile?.uid));
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-0">
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold dark:text-white flex items-center">
            <Users className="mr-3 text-blue-500" /> Groups
          </h1>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCreating(true)} 
            className="flex items-center bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold px-4 py-2 rounded-full shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="h-4 w-4 mr-2" /> Create
          </motion.button>
        </div>

        {/* Search & Filters */}
        <div className="px-4 pb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search groups..."
              className="w-full bg-gray-100 dark:bg-gray-800 border-none rounded-full py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white dark:placeholder-gray-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'all' ? 'bg-blue-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
            >
              Discover
            </button>
            <button
              onClick={() => setFilter('mine')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'mine' ? 'bg-blue-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
            >
              My Groups
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Loading groups...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{searchQuery ? 'No groups found' : 'No groups yet'}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{searchQuery ? 'Try a different search term.' : 'Be the first to create a group!'}</p>
            {!searchQuery && (
              <Button onClick={() => setIsCreating(true)} className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-6">
                <Plus className="h-4 w-4 mr-2" /> Create Group
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGroups.map((group, idx) => {
              const theme = getGroupTheme(group.themeId, group.id);
              const isMember = group.members?.includes(userProfile?.uid);
              const canManageGroup =
                group.creatorId === userProfile?.uid ||
                group.admins?.includes(userProfile?.uid) ||
                (group.moderators?.includes(userProfile?.uid) && group.modsCanManageRequests === true);
              return (
                <motion.div 
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ y: -3 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:shadow-lg transition-all group"
                  onClick={() => navigate(`/group/${group.id}`)}
                >
                  <div className={`relative h-24 bg-gradient-to-br ${theme.classes}`}>
                    {group.bannerURL && (
                      <img
                        src={group.bannerURL}
                        alt={`${group.name} banner`}
                        className="absolute inset-0 h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    <div className="absolute bottom-3 left-3 flex items-center space-x-1.5">
                      <div className={`h-10 w-10 overflow-hidden rounded-xl bg-gradient-to-br ${theme.classes} flex items-center justify-center text-lg shadow-md border-2 border-white/30`}>
                        {group.photoURL ? (
                          <img
                            src={group.photoURL}
                            alt={group.name}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span>{group.badgeEmoji || DEFAULT_GROUP_BADGE}</span>
                        )}
                      </div>
                    </div>
                    {isMember && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Joined</div>
                    )}
                    {canManageGroup && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/group/${group.id}?manage=1`);
                        }}
                        className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm transition hover:bg-black/35"
                      >
                        <Settings className="h-3 w-3" />
                        Manage
                      </button>
                    )}
                    {group.category && (
                      <div className="absolute bottom-2 right-2 bg-black/30 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
                        {group.category}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-base dark:text-white group-hover:text-blue-500 transition-colors line-clamp-1">{group.name}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 line-clamp-2">{group.description || 'No description'}</p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 text-xs">
                        <span className="flex items-center"><Users className="h-3 w-3 mr-1" />{group.membersCount || 0}</span>
                        <span className="flex items-center">{group.privacy === 'private' ? <Lock className="h-3 w-3 mr-1" /> : <Globe className="h-3 w-3 mr-1" />}{group.privacy || 'public'}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-bold flex items-center dark:text-white">
                  <Sparkles className="mr-2 text-blue-500" /> Create Group
                </h2>
                <button onClick={() => setIsCreating(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="p-5 space-y-5 overflow-y-auto flex-1">
                {/* Preview Banner */}
                <div className={`relative h-28 rounded-xl overflow-hidden bg-gradient-to-br ${getGroupTheme(newGroupThemeId, newGroupName || 'new-group').classes}`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-3 flex items-end gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-xl text-white shadow-lg backdrop-blur-sm">
                      <span>{Array.from(newGroupBadgeEmoji.trim()).slice(0, 2).join('') || DEFAULT_GROUP_BADGE}</span>
                    </div>
                    <div>
                    <p className="text-white font-bold text-lg drop-shadow">{newGroupName || 'Group Name'}</p>
                    <p className="text-white/70 text-xs truncate max-w-48">{newGroupDesc || 'Add a description...'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Group Name *</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-900 dark:text-white"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Give your group a name"
                    maxLength={40}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
                  <textarea
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-900 dark:text-white resize-none"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="What's your group about?"
                    rows={3}
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setNewGroupCategory(cat)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          newGroupCategory === cat 
                            ? 'bg-blue-500 text-white shadow-md' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Badge</label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-center text-xl focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-900 dark:text-white"
                      value={newGroupBadgeEmoji}
                      onChange={(e) => setNewGroupBadgeEmoji(Array.from(e.target.value).slice(0, 2).join(''))}
                      placeholder={DEFAULT_GROUP_BADGE}
                      maxLength={4}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Theme</label>
                    <div className="grid grid-cols-3 gap-2">
                      {GROUP_THEME_OPTIONS.map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setNewGroupThemeId(theme.id)}
                          className={`h-12 rounded-2xl border-2 bg-gradient-to-br ${theme.classes} transition ${
                            newGroupThemeId === theme.id ? 'border-white ring-2 ring-blue-500' : 'border-transparent hover:scale-[1.02]'
                          }`}
                          title={theme.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Privacy</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setNewGroupPrivacy('public')}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        newGroupPrivacy === 'public' 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <Globe className={`h-6 w-6 mx-auto mb-1 ${newGroupPrivacy === 'public' ? 'text-blue-500' : 'text-gray-400'}`} />
                      <p className={`font-bold text-sm ${newGroupPrivacy === 'public' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>Public</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Anyone can join</p>
                    </button>
                    <button
                      onClick={() => setNewGroupPrivacy('private')}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        newGroupPrivacy === 'private'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <Lock className={`h-6 w-6 mx-auto mb-1 ${newGroupPrivacy === 'private' ? 'text-blue-500' : 'text-gray-400'}`} />
                      <p className={`font-bold text-sm ${newGroupPrivacy === 'private' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>Private</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Request to join</p>
                    </button>
                  </div>
                </div>

                <Button 
                  onClick={handleCreateGroup} 
                  disabled={!newGroupName.trim() || isCreatingGroup}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold h-12 rounded-xl shadow-lg"
                >
                  {isCreatingGroup ? 'Creating...' : 'Create Group'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
