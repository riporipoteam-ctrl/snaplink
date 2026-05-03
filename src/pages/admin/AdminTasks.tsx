import React, { useState, useEffect } from 'react';
import { useAuth, UserProfile } from '../../contexts/AuthContext';
import { Shield, Plus, CheckCircle, Circle, Trash2, X, Search } from 'lucide-react';
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { motion, AnimatePresence } from 'motion/react';
import { createNotification } from '../../lib/notifications';
import { searchUsersByQuery } from '../../lib/userSearch';
import { canManageTasks } from '../../lib/adminPermissions';
import { logAdminAction } from '../../lib/adminLogs';

export function AdminTasks() {
  const { userProfile } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [assignedUser, setAssignedUser] = useState<UserProfile | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserProfile[]>([]);
  const [creating, setCreating] = useState(false);

  const canEditTasks = canManageTasks(userProfile?.role);
  const isMember = userProfile?.role === 'member';

  useEffect(() => {
    if (!canEditTasks && !isMember) return;

    const fetchTasks = async () => {
      try {
        const q = query(collection(db, 'admin_tasks'));
        const snapshot = await getDocs(q);
        setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'admin_tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [canEditTasks, isMember]);

  const searchUsers = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setUserResults([]);
      return;
    }
    try {
      const filtered = await searchUsersByQuery(searchQuery, { limit: 5 });
      setUserResults(filtered);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(userSearch), 300);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const handleAddTask = async () => {
    if (!taskTitle.trim()) return;
    setCreating(true);

    try {
      const docRef = await addDoc(collection(db, 'admin_tasks'), {
        title: taskTitle,
        description: taskDescription,
        priority: taskPriority,
        assignedTo: assignedUser?.uid || null,
        assignedToName: assignedUser?.displayName || null,
        assignedToPhoto: assignedUser?.photoURL || null,
        completed: false,
        createdAt: serverTimestamp(),
        createdBy: userProfile?.uid
      });

      if (assignedUser?.uid) {
        await createNotification({
          type: 'task',
          title: 'New team task',
          message: `${taskTitle}${taskDescription ? ` — ${taskDescription}` : ''}`,
          sourceUserId: userProfile?.uid || 'system',
          targetUserId: assignedUser.uid,
          linkTo: '/admin/tasks',
          sourceUser: {
            displayName: userProfile?.displayName || 'Ripo Team',
            photoURL: userProfile?.photoURL || null,
          },
        });
      }
      if (userProfile) {
        await logAdminAction({
          actorId: userProfile.uid,
          actorDisplayName: userProfile.displayName,
          actorRole: userProfile.role,
          action: 'Created team task',
          targetType: 'task',
          targetId: docRef.id,
          targetLabel: taskTitle,
          details: assignedUser ? `Assigned to ${assignedUser.displayName}` : 'Unassigned task',
        });
      }

      setTasks([...tasks, {
        id: docRef.id,
        title: taskTitle,
        description: taskDescription,
        priority: taskPriority,
        assignedTo: assignedUser?.uid || null,
        assignedToName: assignedUser?.displayName || null,
        assignedToPhoto: assignedUser?.photoURL || null,
        completed: false
      }]);
      setTaskTitle('');
      setTaskDescription('');
      setTaskPriority('medium');
      setAssignedUser(null);
      setUserSearch('');
      setShowCreateModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'admin_tasks');
    } finally {
      setCreating(false);
    }
  };

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'admin_tasks', taskId), {
        completed: !currentStatus
      });
      setTasks(tasks.map(t => t.id === taskId ? { ...t, completed: !currentStatus } : t));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `admin_tasks/${taskId}`);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const task = tasks.find((entry) => entry.id === taskId);
      await deleteDoc(doc(db, 'admin_tasks', taskId));
      if (userProfile) {
        await logAdminAction({
          actorId: userProfile.uid,
          actorDisplayName: userProfile.displayName,
          actorRole: userProfile.role,
          action: 'Deleted team task',
          targetType: 'task',
          targetId: taskId,
          targetLabel: task?.title || 'Task',
        });
      }
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `admin_tasks/${taskId}`);
    }
  };

  if (!canEditTasks && !isMember) {
    return <div className="p-8 text-center text-red-500">Access Denied.</div>;
  }

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center"><Shield className="mr-2 text-blue-500" /> Team Tasks</h1>
        </div>
      </div>
      <div className="p-4 max-w-3xl mx-auto">
        {canEditTasks && (
          <Button onClick={() => setShowCreateModal(true)} className="mb-6 w-full text-lg h-14 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0">
            <Plus className="h-5 w-5 mr-2" /> Create New Task
          </Button>
        )}

        {/* Create Task Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowCreateModal(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-h-[80vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold dark:text-white">Create New Task</h2>
                  <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                    <input
                      type="text"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="Task title..."
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</label>
                    <textarea
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      placeholder="Describe the task..."
                      rows={3}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                    <div className="flex space-x-2">
                      {(['low', 'medium', 'high'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setTaskPriority(p)}
                          className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                            taskPriority === p
                              ? p === 'low' ? 'bg-green-100 border-green-400 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-400'
                              : p === 'medium' ? 'bg-yellow-100 border-yellow-400 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-400'
                              : 'bg-red-100 border-red-400 text-red-700 dark:bg-red-900/30 dark:border-red-600 dark:text-red-400'
                              : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Assign to</label>
                    {assignedUser ? (
                      <div className="flex items-center justify-between p-3 border border-blue-200 dark:border-blue-700 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                        <div className="flex items-center space-x-3">
                          <Avatar src={assignedUser.photoURL} alt={assignedUser.displayName} size="sm" />
                          <div>
                            <div className="font-semibold text-sm dark:text-white">{assignedUser.displayName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">@{assignedUser.username}</div>
                          </div>
                        </div>
                        <button onClick={() => { setAssignedUser(null); setUserSearch(''); }} className="text-red-500 hover:text-red-600 text-sm font-medium">Remove</button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Search for a user..."
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                        />
                        {userResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                            {userResults.map(u => (
                              <button
                                key={u.uid}
                                onClick={() => { setAssignedUser(u); setUserSearch(''); setUserResults([]); }}
                                className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                              >
                                <Avatar src={u.photoURL} alt={u.displayName} size="sm" />
                                <div>
                                  <div className="font-semibold text-sm dark:text-white">{u.displayName}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">@{u.username}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleAddTask}
                    disabled={!taskTitle.trim() || creating}
                    className="w-full h-12 rounded-xl text-lg bg-blue-500 hover:bg-blue-600 text-white border-0 disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Task'}
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading tasks...</div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {tasks
                .filter(task => canEditTasks || task.assignedTo === userProfile?.uid)
                .map(task => (
                <motion.div 
                  key={task.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className={`flex items-start flex-1 ${canEditTasks ? 'cursor-pointer' : ''}`} onClick={() => canEditTasks && toggleTask(task.id, task.completed)}>
                      {task.completed ? (
                        <CheckCircle className="h-6 w-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-6 w-6 text-gray-300 mr-3 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className={`text-lg block ${task.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                          {task.title}
                        </span>
                        {task.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{task.description}</p>
                        )}
                        <div className="flex items-center space-x-3 mt-2">
                          {task.priority && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              task.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            }`}>
                              {task.priority}
                            </span>
                          )}
                          {task.assignedToName && (
                            <div className="flex items-center space-x-1.5">
                              <img src={task.assignedToPhoto} alt={task.assignedToName} className="h-5 w-5 rounded-full object-cover" />
                              <span className="text-xs text-gray-500 dark:text-gray-400">{task.assignedToName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {canEditTasks && (
                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all ml-2"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {tasks.length === 0 && <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">No tasks yet. Add one above!</div>}
          </div>
        )}
      </div>
    </div>
  );
}
