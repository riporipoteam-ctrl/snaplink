import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMeeting } from '../../contexts/MeetingContext';
import { Shield, Video, Users, Calendar, Clock, Play, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { createNotificationForUsers, getRoleUserIds } from '../../lib/notifications';

export function AdminMeetings() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const isMember = userProfile?.role === 'member';
  const isModerator = userProfile?.role === 'moderator';
  const canAccessMeetings = isAdmin || isMember || isModerator;
  const { inMeeting, startMeeting, participantCount, participants } = useMeeting();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDay, setNewDay] = useState('Mon');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'meeting_schedules'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      try { handleFirestoreError(error, OperationType.LIST, 'meeting_schedules'); } catch(e) {}
    });
    return () => unsubscribe();
  }, []);

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDay || !newDate || !newTime) return;

    try {
      await addDoc(collection(db, 'meeting_schedules'), {
        title: newTitle,
        day: newDay,
        date: newDate,
        time: newTime,
        createdAt: serverTimestamp()
      });

      const teamUserIds = await getRoleUserIds(['admin', 'member']);
      await createNotificationForUsers(teamUserIds, {
        type: 'meeting',
        title: 'New meeting scheduled',
        message: `${newTitle} is scheduled for ${newDay} ${newDate} at ${newTime}.`,
        sourceUserId: userProfile?.uid || 'system',
        linkTo: '/admin/meetings',
        sourceUser: {
          displayName: userProfile?.displayName || 'Ripo Team',
          photoURL: userProfile?.photoURL || null,
        },
      });

      setIsAdding(false);
      setNewTitle('');
      setNewDate('');
      setNewTime('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'meeting_schedules');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        await deleteDoc(doc(db, 'meeting_schedules', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'meeting_schedules');
      }
    }
  };

  if (!canAccessMeetings) {
    return <div className="p-8 text-center text-red-500">Access Denied.</div>;
  }

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center"><Video className="mr-2 text-blue-500" /> Team Meetings</h1>
        </div>
      </div>
      
      <div className="p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border border-blue-100 rounded-2xl p-8 text-center mb-8"
        >
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="bg-blue-500 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
          >
            <Video className="h-8 w-8" />
          </motion.div>
          <h2 className="text-2xl font-bold text-blue-900 mb-2">RIPO Team Meeting Room</h2>
          <p className="text-blue-700 mb-4 max-w-md mx-auto">
            Join the persistent team meeting room to collaborate with admins and members in real-time.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-blue-800 border border-blue-200 mb-6">
            <Users className="h-4 w-4 text-blue-500" />
            {participantCount} participant{participantCount === 1 ? '' : 's'} connected
          </div>
          
          {canAccessMeetings && !inMeeting ? (
            <Button 
              onClick={() => { void startMeeting(); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all"
            >
              <Play className="h-5 w-5 mr-2" /> Join Meeting Room
            </Button>
          ) : inMeeting ? (
            <div className="inline-block bg-green-100 text-green-800 px-6 py-3 rounded-xl font-bold border border-green-200">
              You are currently in the meeting room.
            </div>
          ) : (
            <div className="inline-block bg-gray-100 text-gray-600 px-6 py-3 rounded-xl font-medium border border-gray-200">
              Team members can join once they have the proper rank.
            </div>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="border border-gray-200 rounded-2xl p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center"><Calendar className="mr-2 text-gray-400" /> Scheduled Syncs</h3>
          {isAdmin && (
              <div className="space-x-2">
                <Button onClick={async () => {
                  if(window.confirm('Delete all schedules?')) {
                    schedules.forEach(s => deleteDoc(doc(db, 'meeting_schedules', s.id)));
                  }
                }} variant="outline" className="text-sm py-1 px-3 h-auto text-red-500 border-red-200 hover:bg-red-50">
                  Clear All
                </Button>
                <Button onClick={() => setIsAdding(!isAdding)} variant="outline" className="text-sm py-1 px-3 h-auto">
                  {isAdding ? 'Cancel' : <><Plus className="h-4 w-4 mr-1" /> Add</>}
                </Button>
              </div>
              )}
            </div>

            <AnimatePresence>
              {isAdding && (
                <motion.form 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleAddSchedule} 
                  className="mb-4 space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200 overflow-hidden"
                >
                  <input type="text" placeholder="Meeting Title" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full p-2 border rounded" required />
                  <div className="flex space-x-2">
                    <select value={newDay} onChange={e => setNewDay(e.target.value)} className="p-2 border rounded w-24">
                      <option value="Mon">Mon</option>
                      <option value="Tue">Tue</option>
                      <option value="Wed">Wed</option>
                      <option value="Thu">Thu</option>
                      <option value="Fri">Fri</option>
                      <option value="Sat">Sat</option>
                      <option value="Sun">Sun</option>
                    </select>
                    <input type="text" placeholder="Date (e.g. 10)" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-24 p-2 border rounded" required />
                    <input type="text" placeholder="Time (e.g. 10:00 AM EST)" value={newTime} onChange={e => setNewTime(e.target.value)} className="flex-1 p-2 border rounded" required />
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">Save Schedule</Button>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              {schedules.length === 0 ? (
                <div className="text-center text-gray-500 py-4">No scheduled meetings.</div>
              ) : (
                schedules.map(schedule => (
                  <div key={schedule.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                    <div className="flex items-start space-x-4">
                      <div className="bg-white p-2 rounded-lg border border-gray-200 text-center min-w-[60px]">
                        <div className="text-xs text-gray-500 font-bold uppercase">{schedule.day}</div>
                        <div className="text-lg font-black">{schedule.date}</div>
                      </div>
                      <div>
                        <div className="font-bold">{schedule.title}</div>
                        <div className="text-sm text-gray-500 flex items-center mt-1"><Clock className="h-3 w-3 mr-1" /> {schedule.time}</div>
                      </div>
                    </div>
                    {isAdmin && (
                    <button onClick={() => handleDeleteSchedule(schedule.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-full">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="border border-gray-200 rounded-2xl p-6"
          >
            <h3 className="font-bold text-lg mb-4 flex items-center"><Users className="mr-2 text-gray-400" /> Meeting Guidelines</h3>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start"><div className="bg-blue-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-3 mt-0.5 shrink-0">1</div> Keep your microphone muted when not speaking.</li>
              <li className="flex items-start"><div className="bg-blue-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-3 mt-0.5 shrink-0">2</div> Use the screen share feature for presentations and code reviews.</li>
              <li className="flex items-start"><div className="bg-blue-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-3 mt-0.5 shrink-0">3</div> You can minimize the meeting to navigate the app while staying connected.</li>
              <li className="flex items-start"><div className="bg-blue-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-3 mt-0.5 shrink-0">4</div> All team members are expected to attend the Weekly Kickoff.</li>
            </ul>
            {participants.length > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3">In Room Now</h4>
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div key={participant.uid} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                      <div>
                        <div className="font-medium text-gray-900">{participant.displayName}</div>
                        <div className="text-xs text-gray-500 capitalize">{participant.role || 'member'}</div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`rounded-full px-2 py-1 ${participant.isMicOn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {participant.isMicOn ? 'Mic on' : 'Muted'}
                        </span>
                        <span className={`rounded-full px-2 py-1 ${participant.isScreenSharing ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                          {participant.isScreenSharing ? 'Sharing' : 'Camera'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
