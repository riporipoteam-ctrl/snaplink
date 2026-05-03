import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type AdminLogEntryInput = {
  actorId: string;
  actorDisplayName: string;
  actorRole?: string | null;
  action: string;
  targetType: 'user' | 'group' | 'post' | 'badge' | 'event' | 'task' | 'announcement' | 'system';
  targetId?: string | null;
  targetLabel?: string | null;
  details?: string | null;
};

export async function logAdminAction(input: AdminLogEntryInput) {
  await addDoc(collection(db, 'admin_logs'), {
    actorId: input.actorId,
    actorDisplayName: input.actorDisplayName,
    actorRole: input.actorRole || 'unknown',
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId || null,
    targetLabel: input.targetLabel || null,
    details: input.details || null,
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
  });
}
