import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Gamepad2, Rocket, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';

type MakeSpaceAvatarId = 'rpm-male' | 'rpm-female' | 'joe';
type MakeSpaceWorldId = 'spaceport' | 'cave' | 'vrcraft' | 'aladin' | 'paris' | 'persian-city' | 'kidville' | 'conference' | 'classroom' | 'galaxy';

type MakeSpaceProfile = {
  version: number;
  avatarId: MakeSpaceAvatarId;
  avatarUrl: string;
  worldId: MakeSpaceWorldId;
  updatedAt: string;
};

const MAKESPACE_PROFILE_VERSION = 4;

const AVATAR_OPTIONS: Array<{
  id: MakeSpaceAvatarId;
  title: string;
  subtitle: string;
  description: string;
  accentClass: string;
  avatarUrl: string;
}> = [
  {
    id: 'rpm-male',
    title: 'Orbit',
    subtitle: 'Ready Player male',
    description: 'Clean explorer preset for social and sci-fi worlds.',
    accentClass: 'from-sky-500/35 via-cyan-400/10 to-transparent',
    avatarUrl: 'https://www.vrspace.org/content/char/rpm-male.glb',
  },
  {
    id: 'rpm-female',
    title: 'Nova',
    subtitle: 'Ready Player female',
    description: 'Balanced preset with a brighter look for group spaces.',
    accentClass: 'from-fuchsia-500/30 via-rose-400/10 to-transparent',
    avatarUrl: 'https://www.vrspace.org/content/char/rpm-female.glb',
  },
  {
    id: 'joe',
    title: 'Joe',
    subtitle: 'VRSpace avatar',
    description: 'VRSpace-native avatar for people who want the default open-world feel.',
    accentClass: 'from-emerald-500/30 via-lime-400/10 to-transparent',
    avatarUrl: 'https://www.vrspace.org/content/char/joe.glb',
  },
];

const WORLD_OPTIONS: Array<{
  id: MakeSpaceWorldId;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'spaceport',
    title: 'Spaceport',
    subtitle: 'Social multiplayer hub',
    description: 'The main social sci-fi world with live players and a strong first impression.',
    imageUrl: 'https://www.vrspace.org/content/worlds/spaceport.jpg',
    icon: <Rocket className="h-5 w-5" />,
  },
  {
    id: 'cave',
    title: 'Cave',
    subtitle: 'Tag game level',
    description: 'An actual game level from VRSpace, built for movement and chasing people around.',
    imageUrl: 'https://www.vrspace.org/content/worlds/cave.jpg',
    icon: <Gamepad2 className="h-5 w-5" />,
  },
  {
    id: 'vrcraft',
    title: 'VRCraft',
    subtitle: 'Sandbox building',
    description: 'Open sandbox-style world with multiplayer exploration and creation energy.',
    imageUrl: 'https://www.vrspace.org/content/worlds/vrcraft.jpg',
    icon: <Wand2 className="h-5 w-5" />,
  },
  {
    id: 'aladin',
    title: 'Aladin',
    subtitle: 'Desert adventure',
    description: 'A small desert village with dynamic terrain and a more adventurous atmosphere.',
    imageUrl: 'https://www.vrspace.org/content/worlds/aladin.jpg',
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    id: 'paris',
    title: 'Paris',
    subtitle: 'Large city roam',
    description: 'Huge city map for wandering, meeting up, and stress-testing exploration together.',
    imageUrl: 'https://www.vrspace.org/content/worlds/paris.jpg',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    id: 'persian-city',
    title: 'Persian City',
    subtitle: 'Hide and seek',
    description: 'A medieval city maze that is genuinely good for hide-and-seek style multiplayer play.',
    imageUrl: 'https://www.vrspace.org/content/worlds/persian-city.jpg',
    icon: <Gamepad2 className="h-5 w-5" />,
  },
  {
    id: 'kidville',
    title: 'Kidville',
    subtitle: 'Play town',
    description: 'A lighter playful town world built around hanging out and simple exploration.',
    imageUrl: 'https://www.vrspace.org/content/worlds/kidville.jpg',
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    id: 'conference',
    title: 'Conference',
    subtitle: 'Stage events',
    description: 'Big conference hall world where people can gather around talks and shared screens.',
    imageUrl: 'https://www.vrspace.org/content/worlds/conference.jpg',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    id: 'classroom',
    title: 'Classroom',
    subtitle: 'Shared screen room',
    description: 'Smaller classroom-style space for screen sharing and more focused sessions.',
    imageUrl: 'https://www.vrspace.org/content/worlds/classroom.jpg',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    id: 'galaxy',
    title: 'Galaxy',
    subtitle: 'Portal network',
    description: 'Starfield world with a giant cosmic vibe and room for future portal-style expansion.',
    imageUrl: 'https://www.vrspace.org/content/worlds/galaxy.jpg',
    icon: <Rocket className="h-5 w-5" />,
  },
];

function getMakeSpaceProfileKey(uid: string) {
  return `snaplink_makespace_profile_${uid}`;
}

function readLocalMakeSpaceProfile(uid?: string | null): MakeSpaceProfile | null {
  if (!uid || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getMakeSpaceProfileKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MakeSpaceProfile;
    return isValidMakeSpaceProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocalMakeSpaceProfile(uid: string, profile: MakeSpaceProfile) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getMakeSpaceProfileKey(uid), JSON.stringify(profile));
}

function isValidMakeSpaceProfile(value: any): value is MakeSpaceProfile {
  return Boolean(
    value &&
      value.version === MAKESPACE_PROFILE_VERSION &&
      typeof value.avatarId === 'string' &&
      typeof value.avatarUrl === 'string' &&
      typeof value.worldId === 'string'
  );
}

function buildLauncherSrc(profile: MakeSpaceProfile, displayName: string, username: string) {
  const params = new URLSearchParams({
    worldKey: profile.worldId,
    worldName: WORLD_OPTIONS.find((world) => world.id === profile.worldId)?.title || profile.worldId,
    avatarUrl: profile.avatarUrl,
    snaplinkName: displayName || username || 'SnapLink Player',
    snaplinkUser: username || 'snaplink',
    launcherVersion: '20260422b',
  });
  return `/makespace-launcher.html?${params.toString()}`;
}

export function MakeSpace() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [profile, setProfile] = useState<MakeSpaceProfile | null>(null);
  const [draftAvatarId, setDraftAvatarId] = useState<MakeSpaceAvatarId>('rpm-male');
  const [draftWorldId, setDraftWorldId] = useState<MakeSpaceWorldId>('spaceport');
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!userProfile?.uid) {
        if (!cancelled) {
          setProfile(null);
          setShowSetup(true);
          setIsHydrating(false);
        }
        return;
      }

      const localProfile = readLocalMakeSpaceProfile(userProfile.uid);
      if (localProfile && !cancelled) {
        setProfile(localProfile);
        setDraftAvatarId(localProfile.avatarId);
        setDraftWorldId(localProfile.worldId);
        setShowSetup(false);
      }

      try {
        const cloudSnap = await getDoc(doc(db, 'makespace_profiles', userProfile.uid));
        const cloudData = cloudSnap.exists() ? cloudSnap.data() : null;
        const resolvedProfile = isValidMakeSpaceProfile(cloudData) ? cloudData : localProfile;

        if (!cancelled) {
          if (resolvedProfile) {
            setProfile(resolvedProfile);
            setDraftAvatarId(resolvedProfile.avatarId);
            setDraftWorldId(resolvedProfile.worldId);
            setShowSetup(false);
            writeLocalMakeSpaceProfile(userProfile.uid, resolvedProfile);
          } else {
            setProfile(null);
            setShowSetup(true);
          }
        }
      } catch {
        if (!cancelled && !localProfile) {
          setProfile(null);
          setShowSetup(true);
        }
      } finally {
        if (!cancelled) {
          setIsHydrating(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [userProfile?.uid]);

  const draftAvatar = useMemo(
    () => AVATAR_OPTIONS.find((avatar) => avatar.id === draftAvatarId) || AVATAR_OPTIONS[0],
    [draftAvatarId]
  );

  const activeWorld = useMemo(
    () => WORLD_OPTIONS.find((world) => world.id === (profile?.worldId || draftWorldId)) || WORLD_OPTIONS[0],
    [draftWorldId, profile?.worldId]
  );

  const launcherSrc = useMemo(() => {
    if (!profile) return null;
    return buildLauncherSrc(profile, userProfile?.displayName || userProfile?.username || 'SnapLink Player', userProfile?.username || 'snaplink');
  }, [profile, userProfile?.displayName, userProfile?.username]);

  const saveProfile = async () => {
    if (!userProfile?.uid) return;
    const selectedAvatar = AVATAR_OPTIONS.find((avatar) => avatar.id === draftAvatarId) || AVATAR_OPTIONS[0];
    const nextProfile: MakeSpaceProfile = {
      version: MAKESPACE_PROFILE_VERSION,
      avatarId: selectedAvatar.id,
      avatarUrl: selectedAvatar.avatarUrl,
      worldId: draftWorldId,
      updatedAt: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      writeLocalMakeSpaceProfile(userProfile.uid, nextProfile);
      await setDoc(doc(db, 'makespace_profiles', userProfile.uid), nextProfile, { merge: true });
      setProfile(nextProfile);
      setShowSetup(false);
    } catch (error) {
      console.error('Could not save MakeSpace profile:', error);
      setProfile(nextProfile);
      setShowSetup(false);
    } finally {
      setIsSaving(false);
    }
  };

  const needsSetup = !profile;

  return (
    <div className="relative h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.24),transparent_30%),linear-gradient(180deg,#020617,#000)] text-white">
      {launcherSrc ? (
        <iframe
          key={launcherSrc}
          src={launcherSrc}
          title="MakeSpace"
          allow="fullscreen; xr-spatial-tracking; microphone; camera; autoplay"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-black/55 px-3 py-2 shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/15"
              title="Exit MakeSpace"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200/75">MakeSpace</div>
              <div className="text-sm font-semibold">{activeWorld.title}</div>
              <div className="mt-0.5 text-[11px] text-white/70">@{userProfile?.username || 'snaplink-admin'}</div>
            </div>
          </div>

          {!isHydrating ? (
            <button
              type="button"
              onClick={() => setShowSetup((current) => !current)}
              className="pointer-events-auto rounded-2xl border border-white/10 bg-black/55 px-3 py-2 text-sm font-medium text-white shadow-xl backdrop-blur-md transition-colors hover:bg-black/70"
            >
              {showSetup ? 'Close setup' : 'Change avatar / game'}
            </button>
          ) : null}
        </div>
      </div>

      {isHydrating ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 px-6 py-5 text-center shadow-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200/75">MakeSpace</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Loading your multiplayer profile</h1>
            <p className="mt-2 text-sm text-white/70">Restoring your saved avatar and world selection now.</p>
          </div>
        </div>
      ) : null}

      {(showSetup || needsSetup) && !isHydrating ? (
        <div className="absolute inset-0 z-50 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.94),rgba(2,6,23,0.98))] px-4 py-20 text-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 px-6 py-6 shadow-2xl backdrop-blur-xl">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200/75">
                {needsSetup ? 'First-time MakeSpace setup' : 'MakeSpace loadout'}
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight">Choose your avatar and pick a real VRSpace world</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72">
                SnapLink now picks the avatar and world here first, then launches you straight into the open-source multiplayer
                world itself. No dead T-pose lobby. No fake N/A game button.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-200">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200/75">Avatar selection</p>
                    <h2 className="text-2xl font-black tracking-tight">Pick your look</h2>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {AVATAR_OPTIONS.map((avatar) => {
                    const isActive = draftAvatarId === avatar.id;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setDraftAvatarId(avatar.id)}
                        className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition-all ${
                          isActive
                            ? 'border-cyan-300 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(103,232,249,0.45)]'
                            : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5'
                        }`}
                      >
                        <div className={`rounded-[1.25rem] bg-gradient-to-br ${avatar.accentClass} p-4`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-lg font-black tracking-tight">{avatar.title}</div>
                              <div className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-white/55">{avatar.subtitle}</div>
                              <p className="mt-2 text-sm text-white/72">{avatar.description}</p>
                            </div>
                            {isActive ? (
                              <span className="rounded-full bg-cyan-300 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-950">
                                Selected
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-200">
                    <Gamepad2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-fuchsia-200/75">Games in the world</p>
                    <h2 className="text-2xl font-black tracking-tight">Choose where MakeSpace drops you</h2>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {WORLD_OPTIONS.map((world) => {
                    const isActive = draftWorldId === world.id;
                    return (
                      <button
                        key={world.id}
                        type="button"
                        onClick={() => setDraftWorldId(world.id)}
                        className={`overflow-hidden rounded-[1.6rem] border text-left transition-all ${
                          isActive
                            ? 'border-fuchsia-300 bg-fuchsia-400/10 shadow-[0_0_0_1px_rgba(244,114,182,0.4)]'
                            : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5'
                        }`}
                      >
                        <div className="h-36 w-full bg-slate-900">
                          <img src={world.imageUrl} alt={world.title} className="h-full w-full object-cover" loading="lazy" />
                        </div>
                        <div className="p-5">
                          <div className="flex items-center justify-between gap-3">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] ${
                                isActive ? 'bg-fuchsia-300 text-slate-950' : 'bg-white/10 text-white/70'
                              }`}
                            >
                              {world.icon}
                              {world.subtitle}
                            </span>
                          </div>
                          <h3 className="mt-4 text-2xl font-black tracking-tight">{world.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-white/72">{world.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/72">
                  The selected world is saved to your SnapLink account, so the next time you open MakeSpace it launches straight
                  into that VRSpace world instead of leaving you on the old portal shell.
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                  {!needsSetup ? (
                    <button
                      type="button"
                      onClick={() => setShowSetup(false)}
                      className="rounded-full border border-white/15 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={isSaving}
                    className="rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isSaving ? 'Saving...' : needsSetup ? 'Start MakeSpace' : 'Save and relaunch'}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 px-6 py-5 shadow-xl backdrop-blur-xl">
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200/75">Current selection</div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/78">
                  Avatar: {draftAvatar.title}
                </span>
                <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/78">
                  World: {WORLD_OPTIONS.find((world) => world.id === draftWorldId)?.title}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
