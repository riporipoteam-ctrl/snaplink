import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile } from '../contexts/AuthContext';
import { normalizeUserSearchQuery } from '../lib/userSearch';

export function UsernameProfileRedirect() {
  const { username = '' } = useParams<{ username: string }>();
  const [targetUid, setTargetUid] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const resolveUser = async () => {
      const normalized = normalizeUserSearchQuery(username).replace(/\s+/g, '');
      const snapshot = await getDocs(collection(db, 'users'));
      const match = snapshot.docs
        .map((userDoc) => userDoc.data() as UserProfile)
        .find((user) => normalizeUserSearchQuery(user.username).replace(/\s+/g, '') === normalized);

      setTargetUid(match?.uid || null);
      setResolved(true);
    };

    void resolveUser();
  }, [username]);

  if (!resolved) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">Opening profile...</div>;
  }

  if (targetUid) {
    return <Navigate to={`/profile/${targetUid}`} replace />;
  }

  return <Navigate to={`/search?q=${encodeURIComponent(username)}`} replace />;
}
