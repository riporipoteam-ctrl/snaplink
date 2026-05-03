import React, { useState, useEffect } from 'react';
import { useAuth, UserProfile } from '../../contexts/AuthContext';
import { Shield, Check, X, Save, CalendarCheck, CalendarX } from 'lucide-react';
import { collection, query, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { motion } from 'motion/react';
import { createNotificationForUsers } from '../../lib/notifications';
import { matchesUserSearch } from '../../lib/userSearch';

export function AdminAttendance() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const isMember = userProfile?.role === 'member';
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'attended' | 'absent' | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [memberSearch, setMemberSearch] = useState('');

  // Member-only: personal attendance history
  const [myRecords, setMyRecords] = useState<{ date: string; status: 'attended' | 'absent' }[]>([]);

  useEffect(() => {
    if (!isAdmin && !isMember) return;

    if (isMember && !isAdmin) {
      // Members: fetch all attendance docs and extract only their own records
      const fetchMyAttendance = async () => {
        try {
          const snapshot = await getDocs(collection(db, 'attendance'));
          const records: { date: string; status: 'attended' | 'absent' }[] = [];
          snapshot.docs.forEach(d => {
            const data = d.data();
            const myStatus = data.records?.[userProfile!.uid];
            if (myStatus) {
              records.push({ date: data.date || d.id, status: myStatus });
            }
          });
          records.sort((a, b) => b.date.localeCompare(a.date));
          setMyRecords(records);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'attendance');
        } finally {
          setLoading(false);
        }
      };
      fetchMyAttendance();
      return;
    }

    // Admin: fetch all team members for marking attendance
    const fetchAdmins = async () => {
      try {
        const q = query(collection(db, 'users'));
        const snapshot = await getDocs(q);
        const adminUsers = snapshot.docs
          .map(doc => doc.data() as UserProfile)
          .filter(u => u.role === 'admin' || u.role === 'moderator' || u.role === 'member');
        setAdmins(adminUsers);
        
        const initialAttendance: Record<string, null> = {};
        adminUsers.forEach(admin => {
          initialAttendance[admin.uid] = null;
        });
        setAttendance(initialAttendance);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } finally {
        setLoading(false);
      }
    };

    fetchAdmins();
  }, [userProfile]);

  const markAttendance = (uid: string, status: 'attended' | 'absent') => {
    setAttendance(prev => ({ ...prev, [uid]: status }));
  };

  const markAll = (status: 'attended' | 'absent') => {
    const newAttendance: Record<string, 'attended' | 'absent'> = {};
    admins.forEach(admin => {
      newAttendance[admin.uid] = status;
    });
    setAttendance(newAttendance);
  };

  const saveAttendance = async () => {
    if (!selectedDate) return alert("Please select a valid date.");
    setSaving(true);
    try {
      const attendanceRef = doc(db, 'attendance', selectedDate);
      
      await setDoc(attendanceRef, {
        date: selectedDate,
        records: attendance,
        recordedBy: userProfile?.uid,
        recordedAt: serverTimestamp()
      });

      await Promise.all(
        (Object.entries(attendance).filter((entry) => Boolean(entry[1])) as Array<[string, 'attended' | 'absent']>)
          .map(([uid, status]) =>
            createNotificationForUsers([uid], {
              type: 'attendance',
              title: 'Attendance updated',
              message: `Attendance for ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString()} was marked as ${status}.`,
              sourceUserId: userProfile?.uid || 'system',
              linkTo: '/admin/attendance',
              sourceUser: {
                displayName: userProfile?.displayName || 'Ripo Team',
                photoURL: userProfile?.photoURL || null,
              },
            })
          )
      );
      
      alert('Attendance saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'attendance');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin && !isMember) {
    return <div className="p-8 text-center text-red-500">Access Denied.</div>;
  }

  // Member view: only their own attendance history
  if (isMember && !isAdmin) {
    const attended = myRecords.filter(r => r.status === 'attended');
    const absent = myRecords.filter(r => r.status === 'absent');

    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 pb-20 md:pb-0">
        <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <div className="p-4">
            <h1 className="text-xl font-bold flex items-center dark:text-white"><Shield className="mr-2 text-blue-500" /> My Attendance</h1>
          </div>
        </div>
        <div className="p-4 max-w-3xl mx-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading your attendance...</div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center">
                  <CalendarCheck className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{attended.length}</div>
                  <div className="text-sm text-green-700 dark:text-green-300">Days Attended</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
                  <CalendarX className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{absent.length}</div>
                  <div className="text-sm text-red-700 dark:text-red-300">Days Absent</div>
                </div>
              </div>

              {/* Full history */}
              <h2 className="text-lg font-bold mb-3 dark:text-white">Attendance History</h2>
              {myRecords.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                  No attendance records found.
                </div>
              ) : (
                <div className="space-y-2">
                  {myRecords.map((record, index) => (
                    <motion.div
                      key={record.date}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800"
                    >
                      <span className="font-medium dark:text-white">{new Date(record.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        record.status === 'attended'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {record.status === 'attended' ? '✓ Attended' : '✗ Absent'}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  const filteredAdmins = memberSearch.trim()
    ? admins.filter((admin) => matchesUserSearch(admin, memberSearch))
    : admins;

  // Admin view: mark attendance for all team members
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-20 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center dark:text-white"><Shield className="mr-2 text-blue-500" /> Team Attendance</h1>
          <div className="flex items-center space-x-4">
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
            />
            <Button onClick={saveAttendance} disabled={saving || Object.values(attendance).some(v => v === null) || !selectedDate} className="rounded-xl px-6">
              <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
      
      <div className="p-4 max-w-3xl mx-auto">
        <div className="mb-4">
          <input
            type="text"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Find a team member by name or username..."
            className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex justify-end space-x-2 mb-6">
          <Button variant="outline" size="sm" onClick={() => markAll('attended')} className="text-green-600 border-green-600 hover:bg-green-50 rounded-xl">
            Mark All Attended
          </Button>
          <Button variant="outline" size="sm" onClick={() => markAll('absent')} className="text-red-600 border-red-600 hover:bg-red-50 rounded-xl">
            Mark All Absent
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading team members...</div>
        ) : (
          <div className="space-y-3">
            {filteredAdmins.map((admin, index) => (
              <motion.div 
                key={admin.uid} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-sm transition-shadow bg-white dark:bg-gray-800"
              >
                <div className="flex items-center space-x-3">
                  <Avatar src={admin.photoURL} alt={admin.displayName} />
                  <div>
                    <div className="font-bold dark:text-white">{admin.displayName}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">@{admin.username}</div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant={attendance[admin.uid] === 'attended' ? 'default' : 'outline'}
                    className={`rounded-full px-4 ${attendance[admin.uid] === 'attended' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}`}
                    onClick={() => markAttendance(admin.uid, 'attended')}
                  >
                    <Check className="h-4 w-4 mr-1" /> Attended
                  </Button>
                  <Button 
                    variant={attendance[admin.uid] === 'absent' ? 'default' : 'outline'}
                    className={`rounded-full px-4 ${attendance[admin.uid] === 'absent' ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}
                    onClick={() => markAttendance(admin.uid, 'absent')}
                  >
                    <X className="h-4 w-4 mr-1" /> Absent
                  </Button>
                </div>
              </motion.div>
            ))}
            {admins.length === 0 && <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">No team members found.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
