import React, { useState, useEffect } from 'react';
import { useAuth, UserProfile } from '../../contexts/AuthContext';
import { Shield, Search, UserPlus, UserMinus, CheckCircle, Crown, Eye, X, Ban, AlertTriangle, ClipboardList, Calendar } from 'lucide-react';
import { collection, query, getDocs, doc, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { searchUsersByQuery } from '../../lib/userSearch';
import { logAdminAction } from '../../lib/adminLogs';

export function AdminTeam() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);

  // Member details modal
  const [detailUser, setDetailUser] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{ tasks: any[]; attendance: any[]; warnings: number; isBanned: boolean; banReason?: string } | null>(null);

  useEffect(() => {
    if (userProfile?.role !== 'admin') return;
    fetchTeamMembers();
  }, [userProfile]);

  const fetchTeamMembers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const allUsers = snapshot.docs.map(doc => doc.data() as UserProfile);
      setTeamMembers(allUsers.filter(u => u.role === 'admin' || u.role === 'moderator' || u.role === 'member'));
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  };

  const viewMemberDetails = async (member: any) => {
    setDetailUser(member);
    setDetailLoading(true);
    setDetailData(null);
    try {
      // Fetch tasks assigned to this user
      const tasksSnap = await getDocs(collection(db, 'admin_tasks'));
      const tasks = tasksSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((t: any) => t.assignedTo === member.uid);

      // Fetch attendance records containing this user
      const attendanceSnap = await getDocs(collection(db, 'attendance'));
      const attendance = attendanceSnap.docs
        .map(d => ({ date: d.id, ...d.data() }))
        .filter((a: any) => a.records && a.records[member.uid])
        .map((a: any) => ({ date: a.date, status: a.records[member.uid] }))
        .sort((a: any, b: any) => b.date.localeCompare(a.date))
        .slice(0, 10);

      setDetailData({
        tasks,
        attendance,
        warnings: member.warnings || 0,
        isBanned: !!member.isBanned,
        banReason: member.banReason
      });
    } catch (error) {
      console.error('Error fetching member details:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const filtered = await searchUsersByQuery(searchQuery, {
        excludeUserIds: userProfile ? [userProfile.uid] : [],
        limit: 14,
      });
      setUsers(filtered);
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const setUserRole = async (user: UserProfile, newRole: 'admin' | 'moderator' | 'member' | 'user') => {
    if (user.role === newRole) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { role: newRole });
      await logAdminAction({
        actorId: userProfile!.uid,
        actorDisplayName: userProfile!.displayName,
        actorRole: userProfile!.role,
        action: `Updated team role to ${newRole}`,
        targetType: 'user',
        targetId: user.uid,
        targetLabel: user.displayName,
        details: `${user.displayName} is now ${newRole}.`,
      });
      
      // Update local state
      setUsers(users.map(u => u.uid === user.uid ? { ...u, role: newRole } : u));
      fetchTeamMembers();
      
      const roleLabel = newRole === 'admin' ? 'Admin' : newRole === 'moderator' ? 'Moderator' : newRole === 'member' ? 'Member' : 'User';
      alert(`${user.displayName} is now a ${roleLabel}!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      alert("Failed to update user role.");
    }
  };

  if (userProfile?.role !== 'admin') {
    return <div className="p-8 text-center text-red-500">Access Denied. Admins only.</div>;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-20 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center dark:text-white"><Shield className="mr-2 text-blue-500" /> Manage RIPO Team</h1>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-10">
          <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Current Team Members</h2>
          <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-900/40">
            {teamMembers.length > 0 ? (
              <div className="space-y-3">
                <AnimatePresence>
                  {teamMembers.map((member, index) => (
                    <motion.div 
                      key={member.uid} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/30 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center space-x-4">
                        <Avatar src={member.photoURL} alt={member.displayName} className="h-12 w-12" />
                        <div>
                          <div className="font-bold flex items-center text-lg dark:text-white">
                            {member.displayName}
                            {member.role === 'admin' && <Shield className="h-5 w-5 text-purple-500 ml-1" />}
                            {member.role === 'moderator' && <CheckCircle className="h-5 w-5 text-amber-500 ml-1" />}
                            {member.role === 'member' && <Crown className="h-5 w-5 text-blue-500 ml-1" />}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">@{member.username}</div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
                            member.role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : member.role === 'moderator'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}>
                            {member.role === 'admin' ? 'Admin' : member.role === 'moderator' ? 'Moderator' : 'Member'}
                          </span>
                        </div>
                      </div>
                      {member.uid !== userProfile.uid && (
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" onClick={() => viewMemberDetails(member)} className="text-gray-600 border-gray-200 hover:bg-gray-50 rounded-full px-3">
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                          {member.role !== 'moderator' && (
                            <Button variant="outline" size="sm" onClick={() => setUserRole(member, 'moderator')} className="text-amber-600 border-amber-200 hover:bg-amber-50 rounded-full px-3">
                              <CheckCircle className="h-4 w-4 mr-1" /> Moderator
                            </Button>
                          )}
                          {member.role !== 'member' && (
                            <Button variant="outline" size="sm" onClick={() => setUserRole(member, 'member')} className="text-blue-600 border-blue-200 hover:bg-blue-50 rounded-full px-3">
                              <Crown className="h-4 w-4 mr-1" /> Member
                            </Button>
                          )}
                          {member.role !== 'admin' && (
                            <Button variant="outline" size="sm" onClick={() => setUserRole(member, 'admin')} className="text-purple-600 border-purple-200 hover:bg-purple-50 rounded-full px-3">
                              <Shield className="h-4 w-4 mr-1" /> Admin
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => setUserRole(member, 'user')} className="text-red-500 border-red-200 hover:bg-red-50 rounded-full px-3">
                            <UserMinus className="h-4 w-4 mr-1" /> Remove
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No team members found.</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Add Team Member</h2>
          <div className="flex space-x-2 mb-6 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search users by name or username..."
              className="flex-1 border border-gray-300 dark:border-gray-700 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm dark:bg-gray-800 dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loading} className="rounded-xl px-6">
              Search
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Searching...</div>
          ) : users.length > 0 ? (
            <div className="space-y-3">
              <AnimatePresence>
                {users.map((user, index) => (
                  <motion.div 
                    key={user.uid} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.05, 0.5) }}
                    className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center space-x-4">
                      <Avatar src={user.photoURL} alt={user.displayName} className="h-12 w-12" />
                      <div>
                        <div className="font-bold text-lg">{user.displayName}</div>
                        <div className="text-sm text-gray-500">@{user.username}</div>
                      </div>
                    </div>
                    {user.role === 'admin' ? (
                      <span className="text-sm font-bold text-purple-600 flex items-center bg-purple-50 px-4 py-2 rounded-full border border-purple-100">
                        <Shield className="h-4 w-4 mr-1" /> Admin
                      </span>
                    ) : user.role === 'moderator' ? (
                      <span className="text-sm font-bold text-amber-600 flex items-center bg-amber-50 px-4 py-2 rounded-full border border-amber-100">
                        <CheckCircle className="h-4 w-4 mr-1" /> Moderator
                      </span>
                    ) : user.role === 'member' ? (
                      <span className="text-sm font-bold text-blue-600 flex items-center bg-blue-50 px-4 py-2 rounded-full border border-blue-100">
                        <Crown className="h-4 w-4 mr-1" /> Member
                      </span>
                    ) : (
                      <div className="flex space-x-2">
                        <Button size="sm" onClick={() => setUserRole(user, 'member')} className="rounded-full px-3 bg-blue-500 hover:bg-blue-600 text-white border-0">
                          <Crown className="h-4 w-4 mr-1" /> Member
                        </Button>
                        <Button size="sm" onClick={() => setUserRole(user, 'moderator')} variant="outline" className="rounded-full px-3 text-amber-600 border-amber-300 hover:bg-amber-50">
                          <CheckCircle className="h-4 w-4 mr-1" /> Moderator
                        </Button>
                        <Button size="sm" onClick={() => setUserRole(user, 'admin')} variant="outline" className="rounded-full px-3 text-purple-600 border-purple-300 hover:bg-purple-50">
                          <Shield className="h-4 w-4 mr-1" /> Admin
                        </Button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : searchQuery ? (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">No users found.</div>
          ) : null}
        </div>
      </div>

      {/* Member Details Modal */}
      <AnimatePresence>
        {detailUser && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setDetailUser(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-[5%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-xl z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center"><Eye className="h-5 w-5 mr-2 text-blue-500" /> Member Details</h2>
                <button onClick={() => setDetailUser(null)} className="p-2 rounded-full hover:bg-gray-100">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* User info */}
              <div className="flex items-center space-x-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <Avatar src={detailUser.photoURL} alt={detailUser.displayName} className="h-16 w-16" />
                <div>
                  <div className="font-bold text-xl flex items-center">
                    {detailUser.displayName}
                    {detailUser.role === 'admin' && <Shield className="h-5 w-5 text-purple-500 ml-1" />}
                    {detailUser.role === 'moderator' && <CheckCircle className="h-5 w-5 text-amber-500 ml-1" />}
                    {detailUser.role === 'member' && <Crown className="h-5 w-5 text-blue-500 ml-1" />}
                  </div>
                  <div className="text-sm text-gray-500">@{detailUser.username}</div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
                    detailUser.role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : detailUser.role === 'moderator'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                  }`}>
                    {detailUser.role === 'admin' ? 'Admin' : detailUser.role === 'moderator' ? 'Moderator' : 'Member'}
                  </span>
                </div>
              </div>

              {detailLoading ? (
                <div className="text-center py-8 text-gray-500">Loading member data...</div>
              ) : detailData ? (
                <div className="space-y-5">
                  {/* Ban Status */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <h3 className="font-bold text-sm text-gray-700 flex items-center mb-2"><Ban className="h-4 w-4 mr-1 text-red-500" /> Ban Status</h3>
                    {detailData.isBanned ? (
                      <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                        <span className="text-sm font-bold text-red-700">BANNED</span>
                        {detailData.banReason && <p className="text-sm text-red-600 mt-1">{detailData.banReason}</p>}
                      </div>
                    ) : (
                      <span className="text-sm text-green-600 font-medium">Not banned</span>
                    )}
                  </div>

                  {/* Warnings */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <h3 className="font-bold text-sm text-gray-700 flex items-center mb-2"><AlertTriangle className="h-4 w-4 mr-1 text-orange-500" /> Warnings</h3>
                    <span className={`text-2xl font-bold ${detailData.warnings > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{detailData.warnings}</span>
                    <span className="text-sm text-gray-500 ml-1">warning{detailData.warnings !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Tasks */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <h3 className="font-bold text-sm text-gray-700 flex items-center mb-2"><ClipboardList className="h-4 w-4 mr-1 text-blue-500" /> Tasks ({detailData.tasks.length})</h3>
                    {detailData.tasks.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {detailData.tasks.map((task: any) => (
                          <div key={task.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                            <span className={task.completed ? 'line-through text-gray-400' : 'text-gray-800'}>{task.title}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              task.completed ? 'bg-green-100 text-green-700' :
                              task.priority === 'high' ? 'bg-red-100 text-red-700' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {task.completed ? 'Done' : task.priority || 'medium'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No tasks assigned</span>
                    )}
                  </div>

                  {/* Attendance */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <h3 className="font-bold text-sm text-gray-700 flex items-center mb-2"><Calendar className="h-4 w-4 mr-1 text-green-500" /> Recent Attendance</h3>
                    {detailData.attendance.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {detailData.attendance.map((rec: any, i: number) => (
                          <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                            <span className="text-gray-700">{rec.date}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              rec.status === 'attended' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {rec.status === 'attended' ? 'Attended' : 'Absent'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No attendance records</span>
                    )}
                  </div>
                </div>
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
