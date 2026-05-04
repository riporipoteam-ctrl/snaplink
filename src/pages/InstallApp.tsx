import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Bell,
  Check,
  Copy,
  Download,
  ExternalLink,
  Home,
  Share2,
  ShieldCheck,
  Smartphone,
  Wifi,
  Zap,
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import {
  ensureNotificationWorker,
  getSystemNotificationSupport,
  requestSystemNotificationPermission,
} from '../lib/browserNotifications';

const PRODUCTION_INSTALL_URL = 'https://snaplinknetwork.netlify.app/install';

function isStandaloneApp() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function useInstallUrl() {
  return React.useMemo(() => {
    if (typeof window === 'undefined') return PRODUCTION_INSTALL_URL;
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    return isLocal ? PRODUCTION_INSTALL_URL : `${window.location.origin}/install`;
  }, []);
}

export function InstallApp() {
  const installUrl = useInstallUrl();
  const [copied, setCopied] = React.useState(false);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const standalone = isStandaloneApp();
  const iosDevice = isIosDevice();
  const support = getSystemNotificationSupport();

  const copyInstallLink = async () => {
    await navigator.clipboard?.writeText(installUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const shareInstallLink = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'Install SnapLink',
        text: 'Open this on iPhone Safari to install SnapLink as a Home Screen app.',
        url: installUrl,
      });
      return;
    }

    await copyInstallLink();
  };

  const enableNotifications = async () => {
    setNotificationMessage('');
    await ensureNotificationWorker();
    const permission = await requestSystemNotificationPermission();

    if (permission === 'granted') {
      setNotificationMessage('Notifications are enabled for this SnapLink app.');
      return;
    }

    setNotificationMessage(support.message);
  };

  const steps = [
    {
      title: 'Open this page in Safari',
      body: 'On iPhone, Safari is the cleanest no-cable installer for SnapLink.',
      icon: Smartphone,
    },
    {
      title: 'Tap the Share button',
      body: 'Use the iOS share sheet at the bottom of Safari.',
      icon: Share2,
    },
    {
      title: 'Choose Add to Home Screen',
      body: 'Name it SnapLink, then tap Add. It will open fullscreen like an app.',
      icon: Home,
    },
    {
      title: 'Open the new SnapLink icon',
      body: 'Sign in, then enable notifications from SnapLink settings or from this page.',
      icon: Bell,
    },
  ];

  return (
    <div className="min-h-[100dvh] overflow-hidden bg-[#020617] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(0,200,255,0.28),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(11,72,255,0.28),transparent_30%),linear-gradient(135deg,#020617_0%,#08111f_50%,#030712_100%)]" />
      <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] blur-3xl" />

      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <nav className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <Logo className="h-11 w-11" animate />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300">SnapLink</p>
              <p className="text-xl font-black tracking-tight">iPhone App</p>
            </div>
          </Link>
          <Link
            to="/login"
            className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-bold text-white/90 backdrop-blur transition hover:bg-white/14"
          >
            Sign in
          </Link>
        </nav>

        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-2xl"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100">
              <Wifi className="h-4 w-4" />
              No cable install path
            </div>
            <h1 className="text-4xl font-black tracking-[-0.06em] sm:text-6xl">
              Install SnapLink on iPhone without plugging into the PC.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              This sets SnapLink up as a real Home Screen web app: fullscreen, own icon, app-style launch, service worker, and iOS notification support where Apple allows it.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={shareInstallLink}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-white px-6 text-base font-black text-slate-950 shadow-[0_22px_55px_rgba(0,200,255,0.22)] transition hover:scale-[1.01] hover:bg-cyan-50"
              >
                <Share2 className="h-5 w-5" />
                Send to iPhone
              </button>
              <button
                type="button"
                onClick={copyInstallLink}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/10 px-6 text-base font-bold text-white backdrop-blur transition hover:bg-white/15"
              >
                {copied ? <Check className="h-5 w-5 text-emerald-300" /> : <Copy className="h-5 w-5" />}
                {copied ? 'Copied' : 'Copy install link'}
              </button>
            </div>

            <div className="mt-5 break-all rounded-3xl border border-white/10 bg-black/24 p-4 font-mono text-sm text-cyan-100">
              {installUrl}
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                <Download className="mb-3 h-5 w-5 text-cyan-300" />
                <p className="font-black">No cable</p>
                <p className="mt-1 text-sm text-slate-300">Works from Safari directly.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                <ShieldCheck className="mb-3 h-5 w-5 text-emerald-300" />
                <p className="font-black">Safe path</p>
                <p className="mt-1 text-sm text-slate-300">No random certificates or sketchy signing stores.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                <Zap className="mb-3 h-5 w-5 text-yellow-300" />
                <p className="font-black">Fast updates</p>
                <p className="mt-1 text-sm text-slate-300">Netlify updates appear without rebuilding an IPA.</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="mx-auto w-full max-w-[24rem]"
          >
            <div className="rounded-[3.2rem] border border-white/16 bg-white/12 p-3 shadow-[0_34px_100px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
              <div className="overflow-hidden rounded-[2.6rem] border border-white/10 bg-slate-950">
                <div className="flex items-center justify-between border-b border-white/10 bg-white/8 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Logo className="h-10 w-10" animate={false} />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">SnapLink</p>
                      <p className="font-black">Home Screen</p>
                    </div>
                  </div>
                  <div className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
                </div>
                <div className="space-y-3 p-5">
                  {steps.map((step, index) => (
                    <div key={step.title} className="flex gap-3 rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-200">
                        <step.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black">
                          {index + 1}. {step.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-300">{step.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/10 p-5">
                  <button
                    type="button"
                    onClick={enableNotifications}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-200"
                  >
                    <Bell className="h-5 w-5" />
                    Enable notifications
                  </button>
                  <p className="mt-3 text-center text-xs leading-5 text-slate-400">
                    {standalone
                      ? notificationMessage || 'You are already inside the installed SnapLink app.'
                      : iosDevice
                        ? 'Install SnapLink first, then open the Home Screen icon to enable iPhone notifications.'
                        : notificationMessage || support.message}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="grid gap-4 pb-8 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-5 backdrop-blur">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Smartphone className="h-5 w-5 text-cyan-300" />
              Why not the IPA without a cable?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              iOS blocks normal unsigned IPA downloads. Free Apple ID signing still needs a pairing/signing step through tools like Sideloadly, and Wi-Fi sideloading normally needs the phone paired first.
            </p>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-5 backdrop-blur">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <ExternalLink className="h-5 w-5 text-cyan-300" />
              What you open on iPhone
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Open <span className="font-mono text-cyan-100">{installUrl}</span> in Safari, then Add to Home Screen. That is the no-cable app path we can fully control today.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
