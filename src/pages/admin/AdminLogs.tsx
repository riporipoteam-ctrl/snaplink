import React, { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { ScrollText, Shield } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { canViewAdminLogs } from '../../lib/adminPermissions';

type AdminLogRecord = {
  id: string;
  actorId: string;
  actorDisplayName: string;
  actorRole?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  details?: string | null;
  createdAt?: string;
};

function formatDateTime(value?: string) {
  if (!value) return 'Unknown time';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  return parsed.toLocaleString();
}

export function AdminLogs() {
  const { userProfile } = useAuth();
  const [logs, setLogs] = useState<AdminLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canViewAdminLogs(userProfile?.role)) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'admin_logs'), orderBy('createdAt', 'desc')));
        setLogs(snapshot.docs.map((logDoc) => ({ id: logDoc.id, ...logDoc.data() } as AdminLogRecord)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'admin_logs');
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile?.role]);

  if (!canViewAdminLogs(userProfile?.role)) {
    return <div className="p-8 text-center text-red-500">Access Denied. Admins only.</div>;
  }

  return (
    <div className="min-h-screen bg-white pb-20 dark:bg-gray-950 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/92 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-950/92">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="flex items-center text-xl font-black text-gray-950 dark:text-white">
            <ScrollText className="mr-2 h-5 w-5 text-blue-500" />
            Admin Logs
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {loading ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            Loading admin activity...
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            No admin actions have been logged yet.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((entry) => (
              <div
                key={entry.id}
                className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                        <Shield className="mr-1 h-3.5 w-3.5" />
                        {entry.actorRole || 'staff'}
                      </span>
                      <span className="text-sm font-bold text-gray-950 dark:text-white">{entry.actorDisplayName}</span>
                    </div>
                    <div className="text-lg font-black tracking-tight text-gray-900 dark:text-white">{entry.action}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {entry.targetLabel || entry.targetId || 'No target'} · {entry.targetType}
                    </div>
                    {entry.details ? (
                      <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {entry.details}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                    {formatDateTime(entry.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
