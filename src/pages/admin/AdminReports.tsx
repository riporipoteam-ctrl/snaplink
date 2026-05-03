import React, { useEffect, useState } from 'react';
import { collection, doc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Flag, CheckCircle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export function AdminReports() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reporterNames, setReporterNames] = useState<Record<string, string>>({});
  const [targetLabels, setTargetLabels] = useState<Record<string, string>>({});
  const [targetLinks, setTargetLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (userProfile?.role !== 'admin') return;

    const unsubscribe = onSnapshot(collection(db, 'reports'), (snapshot) => {
      const nextReports = snapshot.docs
        .map(reportDoc => ({ id: reportDoc.id, ...reportDoc.data() }))
        .sort((a: any, b: any) => {
          const aTime = typeof a.createdAt === 'string'
            ? new Date(a.createdAt).getTime()
            : a.createdAt?.toDate?.()?.getTime?.() || 0;
          const bTime = typeof b.createdAt === 'string'
            ? new Date(b.createdAt).getTime()
            : b.createdAt?.toDate?.()?.getTime?.() || 0;
          return bTime - aTime;
        });

      setReports(nextReports);
      setLoading(false);

      void (async () => {
        const reporterEntries = await Promise.all(
          [...new Set(nextReports.map((report: any) => report.reporterId).filter(Boolean))].map(async (uid) => {
            try {
              const userSnap = await getDoc(doc(db, 'users', uid));
              return [uid, userSnap.exists() ? (userSnap.data().displayName || uid) : uid] as const;
            } catch {
              return [uid, uid] as const;
            }
          })
        );

        const nextReporterNames = Object.fromEntries(reporterEntries);
        const nextTargetLabels: Record<string, string> = {};
        const nextTargetLinks: Record<string, string> = {};

        await Promise.all(nextReports.map(async (report: any) => {
          const key = report.id;
          if (report.linkTo) {
            nextTargetLinks[key] = report.linkTo;
          }

          if (report.targetType === 'user') {
            try {
              const userSnap = await getDoc(doc(db, 'users', report.targetId));
              nextTargetLabels[key] = userSnap.exists() ? (userSnap.data().displayName || report.targetId) : report.targetId;
              nextTargetLinks[key] = nextTargetLinks[key] || `/profile/${report.targetId}`;
            } catch {
              nextTargetLabels[key] = report.targetId;
            }
            return;
          }

          if (report.targetType === 'post') {
            try {
              const postSnap = await getDoc(doc(db, 'posts', report.targetId));
              const content = postSnap.exists() ? String(postSnap.data().content || '').trim() : '';
              nextTargetLabels[key] = content ? content.slice(0, 90) : `Post ${report.targetId}`;
              nextTargetLinks[key] = nextTargetLinks[key] || `/post/${report.targetId}`;
            } catch {
              nextTargetLabels[key] = `Post ${report.targetId}`;
            }
            return;
          }

          if (report.targetType === 'comment') {
            try {
              const commentSnap = await getDoc(doc(db, 'comments', report.targetId));
              if (commentSnap.exists()) {
                const data = commentSnap.data();
                nextTargetLabels[key] = String(data.content || 'Comment').slice(0, 90);
                if (data.postId) {
                  nextTargetLinks[key] = `/post/${data.postId}`;
                }
              } else {
                nextTargetLabels[key] = `Comment ${report.targetId}`;
              }
            } catch {
              nextTargetLabels[key] = `Comment ${report.targetId}`;
            }
            return;
          }

          if (report.targetType === 'group') {
            try {
              const groupSnap = await getDoc(doc(db, 'groups', report.targetId));
              nextTargetLabels[key] = groupSnap.exists() ? (groupSnap.data().name || report.targetId) : report.targetId;
              nextTargetLinks[key] = nextTargetLinks[key] || `/groups/${report.targetId}`;
            } catch {
              nextTargetLabels[key] = report.targetId;
            }
            return;
          }

          nextTargetLabels[key] = report.targetType === 'livestream' ? 'Live stream' : report.targetType === 'chat' ? 'Chat conversation' : report.targetId;
          if (report.targetType === 'livestream') nextTargetLinks[key] = nextTargetLinks[key] || '/live';
          if (report.targetType === 'chat') nextTargetLinks[key] = nextTargetLinks[key] || '/messages';
        }));

        setReporterNames(nextReporterNames);
        setTargetLabels(nextTargetLabels);
        setTargetLinks(nextTargetLinks);
      })();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reports');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile]);

  const resolveReport = async (reportId: string) => {
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setReports(reports.filter(r => r.id !== reportId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reports/${reportId}`);
    }
  };

  if (userProfile?.role !== 'admin') {
    return <div className="p-8 text-center text-red-500">Access Denied. Admins only.</div>;
  }

  const formatReportDate = (value: any) => {
    if (!value) return 'Recent';
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? 'Recent' : format(parsed, 'MMM d, yyyy');
    }
    if (typeof value?.toDate === 'function') {
      return format(value.toDate(), 'MMM d, yyyy');
    }
    return 'Recent';
  };

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center"><Flag className="mr-2 text-red-500" /> Reports</h1>
        </div>
      </div>
      
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading reports...</div>
      ) : (
        <div className="p-4 space-y-4">
          {reports.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">No reports found. All good!</div>
          ) : (
            <AnimatePresence>
              {reports.map((report, index) => (
                <motion.div 
                  key={report.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: Math.min(index * 0.05, 0.5) }}
                  className="p-5 border border-gray-200 rounded-xl hover:shadow-md transition-shadow bg-white"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="bg-red-100 p-2 rounded-full">
                        <Flag className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 capitalize block">{report.targetType} Report</span>
                        <span className="text-xs text-gray-500">{formatReportDate(report.createdAt)}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-full px-4 border-green-500 text-green-600 hover:bg-green-50" onClick={() => resolveReport(report.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Resolve
                    </Button>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-3">
                    <p className="text-sm font-bold text-red-800 mb-1">Reason: {report.reason}</p>
                    {report.details && <p className="text-sm text-red-700">{report.details}</p>}
                  </div>
                  <div className="text-xs text-gray-400 flex flex-col sm:flex-row sm:justify-between bg-gray-50 p-2 rounded-lg">
                    <span className="truncate">Reported by: {reporterNames[report.reporterId] || report.reporterId}</span>
                    <span className="truncate">Target: {targetLabels[report.id] || report.targetId}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {targetLinks[report.id] && (
                      <Button size="sm" variant="outline" className="rounded-full px-4" onClick={() => navigate(targetLinks[report.id])}>
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Open target
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="rounded-full px-4" onClick={() => navigate(`/profile/${report.reporterId}`)}>
                      <ExternalLink className="mr-1 h-4 w-4" />
                      Open reporter
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
}
