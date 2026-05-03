export type VisibleStatus = 'online' | 'idle' | 'dnd' | 'offline';
export type ActualPresenceStatus = 'online' | 'idle' | 'offline';

type StatusProfile = {
  activityStatus?: VisibleStatus;
  actualPresenceStatus?: ActualPresenceStatus;
  statusSetAt?: string;
  lastSeen?: string;
};

export function getVisibleStatus(profile?: StatusProfile | null): VisibleStatus {
  return profile?.activityStatus || 'online';
}

export function getActualPresenceStatus(profile?: StatusProfile | null): ActualPresenceStatus {
  return profile?.actualPresenceStatus || (profile?.lastSeen ? 'offline' : 'online');
}

export function getStatusTimestamp(profile?: StatusProfile | null) {
  return profile?.statusSetAt || profile?.lastSeen || null;
}

export function getStatusLabel(status: VisibleStatus | ActualPresenceStatus) {
  switch (status) {
    case 'online':
      return 'Online';
    case 'idle':
      return 'Idle';
    case 'dnd':
      return 'Do Not Disturb';
    default:
      return 'Offline';
  }
}

export function getStatusDotClass(status: VisibleStatus | ActualPresenceStatus) {
  switch (status) {
    case 'online':
      return 'bg-green-500';
    case 'idle':
      return 'bg-yellow-500';
    case 'dnd':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
}

export function getStatusTextClass(status: VisibleStatus | ActualPresenceStatus) {
  switch (status) {
    case 'online':
      return 'text-green-500';
    case 'idle':
      return 'text-yellow-600';
    case 'dnd':
      return 'text-red-500';
    default:
      return 'text-gray-400';
  }
}
