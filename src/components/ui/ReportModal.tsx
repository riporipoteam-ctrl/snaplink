import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle } from 'lucide-react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from './Button';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: 'post' | 'comment' | 'user' | 'group' | 'livestream' | 'chat';
}

const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or bullying',
  'Hate speech or symbols',
  'Violence or dangerous organizations',
  'Nudity or sexual activity',
  'Intellectual property violation',
  'Other'
];

export function ReportModal({ isOpen, onClose, targetId, targetType }: ReportModalProps) {
  const { userProfile } = useAuth();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    setLoading(true);
    try {
      const reportRef = doc(collection(db, 'reports'));
      const linkTo = targetType === 'post'
        ? `/post/${targetId}`
        : targetType === 'user'
          ? `/profile/${targetId}`
          : targetType === 'group'
            ? `/groups/${targetId}`
            : targetType === 'livestream'
              ? '/live'
              : targetType === 'chat'
                ? '/messages'
                : undefined;
      await setDoc(reportRef, {
        id: reportRef.id,
        reporterId: userProfile.uid,
        targetId,
        targetType,
        reason,
        details,
        status: 'pending',
        linkTo,
        createdAt: new Date().toISOString(),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        setDetails('');
        setReason(REPORT_REASONS[0]);
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reports');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl"
        >
          <div className="flex justify-between items-center p-4 border-b border-gray-100">
            <h2 className="text-xl font-bold flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
              Report {targetType}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4">
            {success ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">Report Submitted</h3>
                <p className="text-gray-500">Thank you for helping keep SnapLink safe. Our team will review this report shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for reporting</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {REPORT_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional details (optional)</label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Provide more context..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading} className="bg-red-500 hover:bg-red-600 text-white">
                    {loading ? 'Submitting...' : 'Submit Report'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function CheckCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
