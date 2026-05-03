export type SystemNotificationPayload = {
  title: string;
  body: string;
  tag: string;
  url?: string;
  icon?: string;
  actions?: Array<{ action: string; title: string; url?: string }>;
};

export type SystemNotificationSupport = {
  supported: boolean;
  reason: 'ready' | 'api-missing' | 'secure-context-required' | 'ios-install-required';
  message: string;
  permission: NotificationPermission | 'unsupported';
};

const SERVICE_WORKER_PATH = '/sw.js';
const SNAPLINK_ICON_PATH = '/favicon.svg?v=20260417c';

let attentionInterval: ReturnType<typeof setInterval> | null = null;
let attentionTimeout: ReturnType<typeof setTimeout> | null = null;
let baseTitle = '';

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandaloneApp() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isNotificationSecureContext() {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  return window.isSecureContext || isLocalhost;
}

export function getSystemNotificationSupport(): SystemNotificationSupport {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      reason: 'api-missing',
      message: 'Notifications are only available in the browser.',
      permission: 'unsupported',
    };
  }

  const hasApis = 'Notification' in window && 'serviceWorker' in navigator;
  const iosDevice = isIosDevice();
  const standalone = isStandaloneApp();
  const secureContext = isNotificationSecureContext();

  if (iosDevice && !standalone) {
    return {
      supported: false,
      reason: 'ios-install-required',
      message: 'On iPhone or iPad, open SnapLink in Safari, add it to your Home Screen, then enable notifications from the installed app.',
      permission: hasApis ? Notification.permission : 'unsupported',
    };
  }

  if (!hasApis) {
    return {
      supported: false,
      reason: 'api-missing',
      message: 'This browser is missing the notification or service worker features SnapLink needs.',
      permission: 'unsupported',
    };
  }

  if (!secureContext) {
    return {
      supported: false,
      reason: 'secure-context-required',
      message: 'Notifications need HTTPS or localhost. This current address is not secure, so the browser is blocking them.',
      permission: Notification.permission,
    };
  }

  return {
    supported: true,
    reason: 'ready',
    message: 'This device can use browser notifications.',
    permission: Notification.permission,
  };
}

export function supportsSystemNotifications() {
  return getSystemNotificationSupport().supported;
}

export async function ensureNotificationWorker() {
  if (!supportsSystemNotifications()) return null;

  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
  } catch (error) {
    console.warn('Failed to register notification worker:', error);
    return null;
  }
}

export async function requestSystemNotificationPermission() {
  const support = getSystemNotificationSupport();
  if (!support.supported) return 'denied' as NotificationPermission;
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

export async function showSystemNotification(payload: SystemNotificationPayload) {
  if (!supportsSystemNotifications() || Notification.permission !== 'granted') return;

  const registration = await ensureNotificationWorker();
  const options: NotificationOptions & {
    actions?: Array<{ action: string; title: string }>;
  } = {
    body: payload.body,
    tag: payload.tag,
    icon: payload.icon || SNAPLINK_ICON_PATH,
    badge: SNAPLINK_ICON_PATH,
    actions: payload.actions?.map((action) => ({
      action: action.action,
      title: action.title,
    })),
    data: {
      url: payload.url || '/notifications',
      actions: payload.actions || [],
    },
  };

  if (registration) {
    await registration.showNotification(payload.title, options as NotificationOptions);
    return;
  }

  new Notification(payload.title, options as NotificationOptions);
}

function playAttentionTone(mode: 'default' | 'call' | 'event' = 'default') {
  if (typeof window === 'undefined') return;
  const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtor) return;

  try {
    const context = new AudioCtor();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const frequencies =
      mode === 'call'
        ? [660, 880]
        : mode === 'event'
        ? [392, 523.25, 659.25]
        : [587.33, 783.99];

    oscillator.type = mode === 'call' ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(frequencies[0], context.currentTime);
    gainNode.gain.setValueAtTime(0.0001, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.04, context.currentTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start();

    frequencies.slice(1).forEach((frequency, index) => {
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + 0.12 * (index + 1));
    });

    oscillator.stop(context.currentTime + 0.38);
    setTimeout(() => {
      void context.close().catch(() => {});
    }, 550);
  } catch {
    // no-op
  }
}

export function clearInAppAttention() {
  if (typeof document === 'undefined') return;

  if (attentionInterval) {
    clearInterval(attentionInterval);
    attentionInterval = null;
  }
  if (attentionTimeout) {
    clearTimeout(attentionTimeout);
    attentionTimeout = null;
  }
  if (baseTitle) {
    document.title = baseTitle;
  }
}

export function triggerInAppAttention(input: {
  title: string;
  durationMs?: number;
  vibration?: number[];
  mode?: 'default' | 'call' | 'event';
}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  clearInAppAttention();
  baseTitle = document.title;
  const alertTitle = input.title.trim();
  let visible = false;

  attentionInterval = setInterval(() => {
    visible = !visible;
    document.title = visible ? `${alertTitle} • SnapLink` : baseTitle;
  }, 900);

  attentionTimeout = setTimeout(() => {
    clearInAppAttention();
  }, input.durationMs || 12000);

  if (navigator.vibrate && input.vibration?.length) {
    navigator.vibrate(input.vibration);
  }

  playAttentionTone(input.mode);

  const clearOnReturn = () => {
    if (document.visibilityState === 'visible') {
      clearInAppAttention();
      window.removeEventListener('focus', clearOnReturn);
      document.removeEventListener('visibilitychange', clearOnReturn);
    }
  };

  window.addEventListener('focus', clearOnReturn);
  document.addEventListener('visibilitychange', clearOnReturn);
}
