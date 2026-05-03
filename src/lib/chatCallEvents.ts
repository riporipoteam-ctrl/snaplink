import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export type CallEventStatus = 'started' | 'answered' | 'declined' | 'missed' | 'ended';
export type CallEventType = 'voice' | 'video';

type CallEventInput = {
  chatId?: string | null;
  callId: string;
  status: CallEventStatus;
  callType: CallEventType;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string | null;
};

function getCallEventText(input: Pick<CallEventInput, 'status' | 'callType' | 'senderName'>) {
  const callLabel = input.callType === 'video' ? 'video call' : 'voice call';
  switch (input.status) {
    case 'started':
      return `${input.senderName} started a ${callLabel}.`;
    case 'answered':
      return `${input.senderName} answered the ${callLabel}.`;
    case 'declined':
      return `${input.senderName} declined the ${callLabel}.`;
    case 'missed':
      return `Missed ${callLabel}.`;
    case 'ended':
      return `${input.senderName} ended the ${callLabel}.`;
    default:
      return `${callLabel} update`;
  }
}

export async function appendCallEventMessage(input: CallEventInput) {
  if (!input.chatId) return;

  const callEventText = getCallEventText(input);
  const messageRef = doc(collection(db, `chats/${input.chatId}/messages`), `call-${input.callId}-${input.status}`);
  await setDoc(messageRef, {
    id: messageRef.id,
    messageType: 'call_event',
    callEvent: {
      callId: input.callId,
      status: input.status,
      callType: input.callType,
    },
    text: callEventText,
    senderId: input.senderId,
    senderName: input.senderName,
    senderPhotoURL: input.senderPhotoURL || null,
    createdAt: serverTimestamp(),
  }, { merge: true });

  await setDoc(doc(db, 'chats', input.chatId), {
    updatedAt: serverTimestamp(),
    lastMessage: callEventText,
  }, { merge: true });
}
