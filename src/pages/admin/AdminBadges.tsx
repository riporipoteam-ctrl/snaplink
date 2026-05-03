import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, getDocs, where, updateDoc, arrayUnion, arrayRemove, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth, UserProfile } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Plus, Trash2, Search, X, Award, UserPlus, ArrowLeft, Upload, Link2, Image as ImageIcon, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { searchUsersByQuery } from '../../lib/userSearch';
import { sanitizeStorageFileName, uploadOptimizedImage } from '../../lib/storageUploads';
import { canCreateBadges, canDeleteBadges } from '../../lib/adminPermissions';
import { logAdminAction } from '../../lib/adminLogs';

interface Badge {
  id: string;
  name: string;
  imageURL: string;
  createdAt: string;
  createdBy: string;
}

export function AdminBadges() {
  const { userProfile } = useAuth();
  const canCreate = canCreateBadges(userProfile?.role);
  const canDelete = canDeleteBadges(userProfile?.role);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newBadgeName, setNewBadgeName] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [isUploading, setIsUploading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assign badge state
  const [assigningBadgeId, setAssigningBadgeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [assignedUsers, setAssignedUsers] = useState<Record<string, UserProfile[]>>({});

  useEffect(() => {
    const q = query(collection(db, 'badges'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBadges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Badge)));
      setLoading(false);
    }, (error) => {
      console.error('Error loading badges:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch users who have each badge
  useEffect(() => {
    if (badges.length === 0) return;
    
    const fetchAssigned = async () => {
      const result: Record<string, UserProfile[]> = {};
      try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        for (const badge of badges) {
          const usersWithBadge: UserProfile[] = [];
          snapshot.docs.forEach(d => {
            const userData = d.data() as UserProfile;
            if (userData.badges?.some(b => b.id === badge.id)) {
              usersWithBadge.push(userData);
            }
          });
          result[badge.id] = usersWithBadge;
        }
      } catch (e) {
        console.error('Error fetching badge users:', e);
      }
      setAssignedUsers(result);
    };
    fetchAssigned();
  }, [badges]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setCreateError('');

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUrlChange = (url: string) => {
    setImageUrlInput(url);
    setCreateError('');
    if (url.trim()) {
      setImagePreview(url.trim());
    } else {
      setImagePreview('');
    }
  };

  const handleCreateBadge = async () => {
    if (!userProfile || !newBadgeName.trim()) return;
    
    setCreateError('');
    setIsUploading(true);

    try {
      let finalImageURL = '';

      if (uploadMode === 'file' && imageFile) {
        const badgeId = `badge_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const uploadedImage = await uploadOptimizedImage(
          imageFile,
          `badges/${badgeId}_${sanitizeStorageFileName(imageFile.name)}`,
          {
            maxWidth: 256,
            maxHeight: 256,
            quality: 0.86,
            allowDataUrlFallback: true,
            preferDataUrl: true,
          }
        );
        finalImageURL = uploadedImage.url;
      } else if (uploadMode === 'url' && imageUrlInput.trim()) {
        finalImageURL = imageUrlInput.trim();
      } else {
        setCreateError('Please select an image file or enter an image URL.');
        setIsUploading(false);
        return;
      }

      const badgeRef = doc(collection(db, 'badges'));
      await setDoc(badgeRef, {
        id: badgeRef.id,
        name: newBadgeName.trim(),
        imageURL: finalImageURL,
        createdAt: new Date().toISOString(),
        createdBy: userProfile.uid,
      });
      await logAdminAction({
        actorId: userProfile.uid,
        actorDisplayName: userProfile.displayName,
        actorRole: userProfile.role,
        action: 'Created badge',
        targetType: 'badge',
        targetId: badgeRef.id,
        targetLabel: newBadgeName.trim(),
      });

      setCreateSuccess(`Badge "${newBadgeName.trim()}" created successfully!`);
      setTimeout(() => setCreateSuccess(''), 3000);
      
      setIsCreating(false);
      setNewBadgeName('');
      setImagePreview('');
      setImageFile(null);
      setImageUrlInput('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      console.error('Error creating badge:', error);
      setCreateError(error?.message || 'Failed to create badge. Check console for details.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteBadge = async (badgeId: string) => {
    if (!window.confirm('Delete this badge? It will be removed from all users.')) return;
    try {
      const badge = badges.find((entry) => entry.id === badgeId);
      await deleteDoc(doc(db, 'badges', badgeId));
      // Remove from all users
      const snapshot = await getDocs(collection(db, 'users'));
      for (const userDoc of snapshot.docs) {
        const userData = userDoc.data() as UserProfile;
        if (userData.badges?.some(b => b.id === badgeId)) {
          const updatedBadges = userData.badges.filter(b => b.id !== badgeId);
          await updateDoc(doc(db, 'users', userDoc.id), { badges: updatedBadges });
        }
      }
      if (userProfile) {
        await logAdminAction({
          actorId: userProfile.uid,
          actorDisplayName: userProfile.displayName,
          actorRole: userProfile.role,
          action: 'Deleted badge',
          targetType: 'badge',
          targetId: badgeId,
          targetLabel: badge?.name || badgeId,
        });
      }
    } catch (error) {
      console.error('Error deleting badge:', error);
    }
  };

  const handleSearchUsers = async (queryText: string) => {
    setSearchQuery(queryText);
    if (queryText.length > 1) {
      setIsSearching(true);
      try {
        const results = await searchUsersByQuery(queryText, { limit: 10 });
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleAssignBadge = async (userId: string, badge: Badge) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        badges: arrayUnion({
          id: badge.id,
          name: badge.name,
          imageURL: badge.imageURL,
          assignedAt: new Date().toISOString(),
        })
      });
      // Refresh assigned users
      const updatedAssigned = { ...assignedUsers };
      const user = searchResults.find(u => u.uid === userId);
      if (user) {
        updatedAssigned[badge.id] = [...(updatedAssigned[badge.id] || []), user];
        setAssignedUsers(updatedAssigned);
        if (userProfile) {
          await logAdminAction({
            actorId: userProfile.uid,
            actorDisplayName: userProfile.displayName,
            actorRole: userProfile.role,
            action: 'Assigned badge',
            targetType: 'user',
            targetId: user.uid,
            targetLabel: user.displayName,
            details: `Badge: ${badge.name}`,
          });
        }
      }
    } catch (error) {
      console.error('Error assigning badge:', error);
    }
  };

  const handleRemoveBadge = async (userId: string, badgeId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userData = assignedUsers[badgeId]?.find(u => u.uid === userId);
      if (!userData) return;
      
      const badgeToRemove = userData.badges?.find(b => b.id === badgeId);
      if (badgeToRemove) {
        await updateDoc(userRef, {
          badges: arrayRemove(badgeToRemove)
        });
        const updatedAssigned = { ...assignedUsers };
        updatedAssigned[badgeId] = updatedAssigned[badgeId]?.filter(u => u.uid !== userId) || [];
        setAssignedUsers(updatedAssigned);
        if (userProfile) {
          await logAdminAction({
            actorId: userProfile.uid,
            actorDisplayName: userProfile.displayName,
            actorRole: userProfile.role,
            action: 'Removed badge',
            targetType: 'user',
            targetId: userId,
            targetLabel: userData.displayName,
            details: `Badge: ${badgeToRemove.name}`,
          });
        }
      }
    } catch (error) {
      console.error('Error removing badge:', error);
    }
  };

  const resetCreateForm = () => {
    setIsCreating(false);
    setNewBadgeName('');
    setImagePreview('');
    setImageFile(null);
    setImageUrlInput('');
    setCreateError('');
    setUploadMode('file');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!canCreate) {
    return <div className="p-8 text-center text-red-500 text-xl font-bold">Access Denied. Staff only.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <div className="p-4 flex items-center space-x-4">
          <Link to="/admin" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="h-5 w-5 dark:text-white" />
          </Link>
          <h1 className="text-xl font-bold flex items-center dark:text-white">
            <Award className="mr-2 text-purple-500" /> Badge Management
          </h1>
        </div>
      </div>

      {/* Success toast */}
      <AnimatePresence>
        {createSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg font-bold flex items-center"
          >
            <Check className="h-5 w-5 mr-2" /> {createSuccess}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 space-y-6">
        {/* Create Badge Hero */}
        <div className="bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-9xl">🏅</div>
          <h2 className="text-2xl font-bold mb-2">Create Custom Badges</h2>
          <p className="text-white/80 mb-4">Upload images or use URLs to create badges, then assign them to users.</p>
          <Button 
            onClick={() => setIsCreating(true)}
            className="bg-white text-purple-600 hover:bg-gray-100 font-bold"
          >
            <Plus className="h-4 w-4 mr-2" /> Create New Badge
          </Button>
        </div>

        {/* Badges Grid */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
            <p className="text-gray-500 dark:text-gray-400 mt-3">Loading badges...</p>
          </div>
        ) : badges.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Award className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No badges created yet</p>
            <p className="text-sm">Create your first badge to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {badges.map((badge) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
              >
                <div className="p-5">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center overflow-hidden border-2 border-purple-200 dark:border-purple-700 shrink-0">
                      <img src={badge.imageURL} alt={badge.name} className="h-12 w-12 object-contain" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%239333ea"><path d="M12 2L15 8.5L22 9.3L17 14L18.2 21L12 17.8L5.8 21L7 14L2 9.3L9 8.5Z"/></svg>'; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg dark:text-white truncate">{badge.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {assignedUsers[badge.id]?.length || 0} users assigned
                      </p>
                    </div>
                    <div className="flex space-x-2 shrink-0">
                      <button
                        onClick={() => setAssigningBadgeId(assigningBadgeId === badge.id ? null : badge.id)}
                        className="p-2 rounded-xl text-purple-500 border border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                        title="Assign to user"
                      >
                        <UserPlus className="h-5 w-5" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteBadge(badge.id)}
                          className="p-2 rounded-xl text-red-500 border border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Delete badge"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Assigned Users */}
                  {assignedUsers[badge.id] && assignedUsers[badge.id].length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Assigned To</p>
                      <div className="flex flex-wrap gap-2">
                        {assignedUsers[badge.id].map(user => (
                          <div key={user.uid} className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-700/50 rounded-full pl-1 pr-3 py-1">
                            <Avatar src={user.photoURL} alt={user.displayName} size="sm" className="h-6 w-6" />
                            <span className="text-xs font-medium dark:text-white">{user.displayName}</span>
                            <button
                              onClick={() => handleRemoveBadge(user.uid, badge.id)}
                              className="text-red-400 hover:text-red-500 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assign Badge Panel */}
                  <AnimatePresence>
                    {assigningBadgeId === badge.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700"
                      >
                        <div className="relative mb-3">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search users to assign..."
                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pl-9 pr-4 focus:ring-2 focus:ring-purple-500 outline-none dark:text-white dark:placeholder-gray-400"
                            value={searchQuery}
                            onChange={(e) => handleSearchUsers(e.target.value)}
                          />
                        </div>
                        {isSearching && <p className="text-sm text-gray-500 text-center py-2">Searching...</p>}
                        {searchResults.length > 0 && (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {searchResults.map(user => {
                              const alreadyHas = assignedUsers[badge.id]?.some(u => u.uid === user.uid);
                              return (
                                <div key={user.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                  <div className="flex items-center space-x-2">
                                    <Avatar src={user.photoURL} alt={user.displayName} size="sm" />
                                    <div>
                                      <p className="font-medium dark:text-white">{user.displayName}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</p>
                                    </div>
                                  </div>
                                  <button
                                    disabled={alreadyHas}
                                    onClick={() => handleAssignBadge(user.uid, badge)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${alreadyHas ? 'opacity-50 bg-gray-200 dark:bg-gray-600 text-gray-500' : 'bg-purple-500 hover:bg-purple-600 text-white'}`}
                                  >
                                    {alreadyHas ? 'Assigned ✓' : 'Assign'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Badge Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold dark:text-white flex items-center">
                  <Award className="mr-2 text-purple-500" /> Create Badge
                </h2>
                <button onClick={resetCreateForm} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Error */}
                {createError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl p-3 text-sm">
                    {createError}
                  </div>
                )}

                {/* Badge Name */}
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-2">Badge Name *</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3.5 focus:ring-2 focus:ring-purple-500 outline-none dark:bg-gray-900 dark:text-white"
                    value={newBadgeName}
                    onChange={(e) => setNewBadgeName(e.target.value)}
                    placeholder="e.g. Top Contributor, OG Member, VIP"
                    maxLength={30}
                  />
                </div>

                {/* Upload Mode Toggle */}
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-2">Badge Image *</label>
                  <div className="flex rounded-xl overflow-hidden border border-gray-300 dark:border-gray-600 mb-3">
                    <button
                      onClick={() => { setUploadMode('file'); setImageUrlInput(''); if (!imageFile) setImagePreview(''); }}
                      className={`flex-1 py-3 font-bold flex items-center justify-center transition-colors ${
                        uploadMode === 'file' ? 'bg-purple-500 text-white' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Upload className="h-4 w-4 mr-2" /> Upload File
                    </button>
                    <button
                      onClick={() => { setUploadMode('url'); setImageFile(null); if (!imageUrlInput) setImagePreview(''); }}
                      className={`flex-1 py-3 font-bold flex items-center justify-center transition-colors ${
                        uploadMode === 'url' ? 'bg-purple-500 text-white' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Link2 className="h-4 w-4 mr-2" /> Paste URL
                    </button>
                  </div>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={handleImageSelect}
                  />

                  {uploadMode === 'file' ? (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="relative cursor-pointer group"
                    >
                      {imageFile ? (
                        <div className="flex items-center space-x-4 p-4 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-300 dark:border-purple-600 rounded-xl">
                          <div className="h-16 w-16 rounded-xl bg-white dark:bg-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                            <img src={imagePreview} alt="Badge preview" className="h-12 w-12 object-contain" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-purple-700 dark:text-purple-300 truncate">{imageFile.name}</p>
                            <p className="text-sm text-purple-500 dark:text-purple-400">{(imageFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                            className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-purple-400 dark:hover:border-purple-500 transition-colors group-hover:bg-purple-50/50 dark:group-hover:bg-purple-900/10">
                          <Upload className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto mb-3 group-hover:text-purple-500 transition-colors" />
                          <p className="font-medium text-gray-600 dark:text-gray-300">Click to select badge image</p>
                          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">PNG, JPG, GIF, SVG or WebP</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <input
                        type="url"
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3.5 focus:ring-2 focus:ring-purple-500 outline-none dark:bg-gray-900 dark:text-white"
                        value={imageUrlInput}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        placeholder="https://example.com/badge.png"
                      />
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Paste a direct link to a PNG, SVG, or other image file.</p>
                    </div>
                  )}
                </div>

                {/* Preview */}
                {imagePreview && newBadgeName && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Preview</p>
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center overflow-hidden border-2 border-purple-200 dark:border-purple-700">
                        <img src={imagePreview} alt="Preview" className="h-8 w-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <div>
                        <p className="font-bold dark:text-white text-lg">{newBadgeName}</p>
                        <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                          <span>Username</span>
                          <img src={imagePreview} alt="" className="h-4 w-4 rounded-full object-cover inline-block" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <span className="text-gray-400">← appears next to names</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload progress */}
                {isUploading && (
                  <div className="flex items-center justify-center py-2 text-purple-500 font-medium">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500 mr-3"></div>
                    Uploading badge...
                  </div>
                )}

                <button
                  onClick={handleCreateBadge} 
                  disabled={!newBadgeName.trim() || (uploadMode === 'file' ? !imageFile : !imageUrlInput.trim()) || isUploading} 
                  className="w-full font-bold bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl h-14 text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Creating...' : 'Create Badge'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
