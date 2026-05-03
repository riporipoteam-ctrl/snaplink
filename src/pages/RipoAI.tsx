import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  FileText,
  Film,
  ImagePlus,
  Menu,
  Paperclip,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { Logo } from '../components/ui/Logo';
import { RipoAIMessageContent } from '../components/ui/RipoAIMessageContent';
import {
  generateRipoAIImage,
  generateRipoAIVideo,
  getRipoAIStreamResponse,
  shouldGenerateImagePrompt,
  shouldGenerateVideoPrompt,
  type RipoAIAttachmentContext,
} from '../lib/ripoai';
import { db } from '../lib/firebase';

type RipoAIAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'video' | 'file';
  excerpt?: string;
  previewUrl?: string;
  downloadUrl?: string;
};

type RipoAIMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  attachments?: RipoAIAttachment[];
};

type RipoAIConversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: RipoAIMessage[];
};

const STORAGE_KEY = 'snaplink_ripoai_conversations_v15';
const MEMORY_STORAGE_KEY = 'snaplink_ripoai_memories_v1';
const CLOUD_STATE_VERSION = 1;
type RipoAIMemory = {
  id: string;
  text: string;
  updatedAt: string;
};
const STARTER_PROMPTS = [
  'Write a cleaner announcement post for SnapLink.',
  'Look at this screenshot and tell me what is broken first.',
  'Plan a better profile page redesign for mobile and desktop.',
  'Turn this rough idea into a sharper feature spec.',
];

function createConversation(): RipoAIConversation {
  return {
    id: crypto.randomUUID(),
    title: 'New chat',
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

function isTextLikeFile(file: File) {
  const lower = file.name.toLowerCase();
  return (
    file.type.startsWith('text/') ||
    ['.md', '.txt', '.json', '.csv', '.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.xml'].some((ext) => lower.endsWith(ext))
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function fileToAttachment(file: File): Promise<RipoAIAttachment> {
  const kind: 'image' | 'file' = file.type.startsWith('image/') ? 'image' : 'file';
  let previewUrl: string | undefined;
  let excerpt: string | undefined;

  if (kind === 'image' && file.size <= 1_800_000) {
    try {
      previewUrl = await fileToDataUrl(file);
    } catch {
      previewUrl = undefined;
    }
  }

  if (isTextLikeFile(file)) {
    try {
      excerpt = (await file.text()).slice(0, 2200);
    } catch {
      excerpt = undefined;
    }
  }

  return {
    id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    kind,
    previewUrl,
    excerpt,
  };
}

function serializeConversations(conversations: RipoAIConversation[]) {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages.map((message) => ({
      ...message,
      attachments: message.attachments?.map(({ id, name, mimeType, size, kind, excerpt, previewUrl, downloadUrl }) => ({
        id,
        name,
        mimeType,
        size,
        kind,
        ...(excerpt ? { excerpt } : {}),
        ...(previewUrl ? { previewUrl } : {}),
        ...(downloadUrl ? { downloadUrl } : {}),
      })),
    })),
  }));
}

function serializeConversationsForStorage(conversations: RipoAIConversation[]) {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages.map((message) => ({
      ...message,
      attachments: message.attachments?.map(({ id, name, mimeType, size, kind, excerpt, previewUrl, downloadUrl }) => ({
        id,
        name,
        mimeType,
        size,
        kind,
        ...(excerpt ? { excerpt } : {}),
        ...(previewUrl && !previewUrl.startsWith('data:') && !previewUrl.startsWith('blob:') ? { previewUrl } : {}),
        ...(downloadUrl ? { downloadUrl } : {}),
      })),
    })),
  }));
}

function persistRipoAIConversations(conversations: RipoAIConversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeConversationsForStorage(conversations)));
  } catch (error) {
    console.warn('Could not save full RipoAI chat history, trimming saved conversations.', error);
    try {
      const trimmed = conversations.slice(0, 8).map((conversation) => ({
        ...conversation,
        messages: conversation.messages.slice(-24),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeConversationsForStorage(trimmed)));
    } catch (trimError) {
      console.warn('Could not save trimmed RipoAI chat history either.', trimError);
    }
  }
}

function getCloudStateDocument(uid: string) {
  return doc(db, 'ripoai_state', uid);
}

function toAttachmentContext(attachments: RipoAIAttachment[]): RipoAIAttachmentContext[] {
  return attachments.map((attachment) => ({
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    excerpt: attachment.excerpt,
    kind: attachment.kind,
    dataUrl: attachment.kind === 'image' ? attachment.previewUrl : undefined,
  }));
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAttachmentKind(kind: RipoAIAttachment['kind']) {
  if (kind === 'image') return 'Image';
  if (kind === 'video') return 'Video';
  return 'File';
}

function getAttachmentDownloadName(attachment: RipoAIAttachment) {
  const extension = attachment.kind === 'video' ? 'webm' : attachment.kind === 'image' ? 'png' : '';
  const cleaned = attachment.name.replace(/[\\/:*?"<>|]+/g, '-').trim();
  if (!extension || cleaned.toLowerCase().endsWith(`.${extension}`)) return cleaned || `ripoai-${attachment.kind}`;
  return `${cleaned || `ripoai-${attachment.kind}`}.${extension}`;
}

function buildContext(attachments: RipoAIAttachment[], userName?: string) {
  const lines = [`User: ${userName || 'SnapLink member'}.`];
  if (attachments.length > 0) {
    lines.push(`Uploads: ${attachments.map((attachment) => attachment.name).join(', ')}.`);
    lines.push('Use the uploaded context naturally in the answer.');
  }
  return lines.join(' ');
}

function normalizeMemoryText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function shouldRememberMessage(message: string) {
  const cleaned = normalizeMemoryText(message);
  if (!cleaned) return false;
  if (cleaned.length < 18 || cleaned.length > 240) return false;
  if (/^(hi|hello|hey|ok|okay|thanks|thx)$/i.test(cleaned)) return false;
  return true;
}

function buildConversationMemoryContext(messages: RipoAIMessage[]) {
  return messages
    .slice(-6)
    .map((message) => `${message.role === 'user' ? 'User' : 'RipoAI'}: ${message.content}`)
    .join('\n');
}

export function RipoAI() {
  const { userProfile } = useAuth();
  const [conversations, setConversations] = useState<RipoAIConversation[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [createConversation()];
      const parsed = JSON.parse(raw) as RipoAIConversation[];
      return parsed.length > 0 ? parsed : [createConversation()];
    } catch {
      return [createConversation()];
    }
  });
  const [activeConversationId, setActiveConversationId] = useState(() => conversations[0]?.id || '');
  const [draft, setDraft] = useState('');
  const [composerAttachments, setComposerAttachments] = useState<RipoAIAttachment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1080 : true));
  const [memories, setMemories] = useState<RipoAIMemory[]>(() => {
    try {
      const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as RipoAIMemory[];
    } catch {
      return [];
    }
  });
  const [isHydratingCloudState, setIsHydratingCloudState] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    persistRipoAIConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    try {
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
    } catch (error) {
      console.warn('Could not save RipoAI memories.', error);
    }
  }, [memories]);

  useEffect(() => {
    let cancelled = false;

    const loadCloudState = async () => {
      if (!userProfile?.uid) {
        if (!cancelled) {
          setIsHydratingCloudState(false);
        }
        return;
      }

      try {
        const cloudSnap = await getDoc(getCloudStateDocument(userProfile.uid));
        if (!cloudSnap.exists()) {
          if (!cancelled) {
            setIsHydratingCloudState(false);
          }
          return;
        }

        const data = cloudSnap.data() as {
          version?: number;
          conversations?: RipoAIConversation[];
          memories?: RipoAIMemory[];
          activeConversationId?: string;
        };

        if (!cancelled && data?.version === CLOUD_STATE_VERSION) {
          const nextConversations = Array.isArray(data.conversations) && data.conversations.length > 0
            ? data.conversations
            : [createConversation()];
          setConversations(nextConversations);
          setMemories(Array.isArray(data.memories) ? data.memories : []);
          setActiveConversationId(
            data.activeConversationId && nextConversations.some((conversation) => conversation.id === data.activeConversationId)
              ? data.activeConversationId
              : nextConversations[0].id
          );
        }
      } catch (error) {
        console.warn('Could not load RipoAI cloud state.', error);
      } finally {
        if (!cancelled) {
          setIsHydratingCloudState(false);
        }
      }
    };

    void loadCloudState();

    return () => {
      cancelled = true;
    };
  }, [userProfile?.uid]);

  useEffect(() => {
    if (isHydratingCloudState || !userProfile?.uid) return;

    const timeoutId = window.setTimeout(() => {
      void setDoc(
        getCloudStateDocument(userProfile.uid),
        {
          version: CLOUD_STATE_VERSION,
          updatedAt: new Date().toISOString(),
          activeConversationId,
          conversations: serializeConversationsForStorage(conversations).slice(0, 18).map((conversation) => ({
            ...conversation,
            messages: conversation.messages.slice(-40),
          })),
          memories: memories.slice(0, 18),
        },
        { merge: true }
      ).catch((error) => {
        console.warn('Could not save RipoAI cloud state.', error);
      });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [activeConversationId, conversations, isHydratingCloudState, memories, userProfile?.uid]);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1080);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isDesktop) setShowSidebar(false);
  }, [isDesktop]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversationId, conversations, isGenerating]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0],
    [activeConversationId, conversations]
  );

  useEffect(() => {
    if (!activeConversation && conversations[0]) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversation, conversations]);

  const updateConversation = (conversationId: string, updater: (conversation: RipoAIConversation) => RipoAIConversation) => {
    setConversations((prev) => prev.map((conversation) => (conversation.id === conversationId ? updater(conversation) : conversation)));
  };

  const createNewConversation = () => {
    const nextConversation = createConversation();
    setConversations((prev) => [nextConversation, ...prev]);
    setActiveConversationId(nextConversation.id);
    setDraft('');
    setComposerAttachments([]);
    setShowSidebar(false);
  };

  const deleteConversation = (conversationId: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((conversation) => conversation.id !== conversationId);
      if (filtered.length === 0) {
        const nextConversation = createConversation();
        setActiveConversationId(nextConversation.id);
        return [nextConversation];
      }
      if (conversationId === activeConversationId) {
        setActiveConversationId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []) as File[];
    if (files.length === 0) return;
    const nextAttachments = await Promise.all(files.map((file) => fileToAttachment(file)));
    setComposerAttachments((prev) => [...prev, ...nextAttachments].slice(0, 6));
    event.target.value = '';
  };

  const sendMessage = async (presetMessage?: string) => {
    const message = (presetMessage || draft).trim();
    if ((!message && composerAttachments.length === 0) || !activeConversation || isGenerating) return;

    const attachments = composerAttachments;
    const nowIso = new Date().toISOString();
    const userMessage: RipoAIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: nowIso,
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantPlaceholder: RipoAIMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: nowIso,
    };
    const recentTranscript = buildConversationMemoryContext(activeConversation.messages);
    const shouldRemember = shouldRememberMessage(message);
    const nextMemoryText = normalizeMemoryText(message);
    const nextMemories = shouldRemember
      ? [
          {
            id: crypto.randomUUID(),
            text: nextMemoryText,
            updatedAt: nowIso,
          },
          ...memories.filter((entry) => entry.text.toLowerCase() !== nextMemoryText.toLowerCase()),
        ].slice(0, 18)
      : memories;

    setDraft('');
    setComposerAttachments([]);
    setShowSidebar(false);
    setIsGenerating(true);
    if (shouldRemember) {
      setMemories(nextMemories);
    }

    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      title: conversation.title === 'New chat' ? (message || attachments[0]?.name || 'New chat').slice(0, 48) : conversation.title,
      updatedAt: nowIso,
      messages: [...conversation.messages, userMessage, assistantPlaceholder],
    }));

    try {
      if (shouldGenerateVideoPrompt(message) && attachments.length === 0) {
        const generatedVideo = await generateRipoAIVideo(message);
        updateConversation(activeConversation.id, (conversation) => ({
          ...conversation,
          updatedAt: new Date().toISOString(),
          messages: conversation.messages.map((conversationMessage) =>
            conversationMessage.id === assistantMessageId
              ? {
                  ...conversationMessage,
                  content: `I made a video for this prompt:\n\n\`${generatedVideo.prompt}\``,
                  attachments: [
                    {
                      id: `video-${Date.now()}`,
                      name: 'Generated video',
                      mimeType: generatedVideo.mimeType,
                      size: generatedVideo.size,
                      kind: 'video',
                      previewUrl: generatedVideo.videoUrl,
                      downloadUrl: generatedVideo.downloadUrl,
                    },
                  ],
                }
              : conversationMessage
          ),
        }));
        return;
      }

      if (shouldGenerateImagePrompt(message) && attachments.length === 0) {
        const generatedImage = await generateRipoAIImage(message);
        updateConversation(activeConversation.id, (conversation) => ({
          ...conversation,
          updatedAt: new Date().toISOString(),
          messages: conversation.messages.map((conversationMessage) =>
            conversationMessage.id === assistantMessageId
              ? {
                  ...conversationMessage,
                  content: `I made an image for this prompt:\n\n\`${generatedImage.prompt}\``,
                  attachments: [
                    {
                      id: `image-${Date.now()}`,
                      name: 'Generated image',
                      mimeType: generatedImage.mimeType,
                      size: generatedImage.size,
                      kind: 'image',
                      previewUrl: generatedImage.imageUrl,
                      downloadUrl: generatedImage.downloadUrl,
                    },
                  ],
                }
              : conversationMessage
          ),
        }));
        return;
      }

      await getRipoAIStreamResponse(
        message || 'Review the uploaded context and help with it.',
        (chunk) => {
          updateConversation(activeConversation.id, (conversation) => ({
            ...conversation,
            updatedAt: new Date().toISOString(),
            messages: conversation.messages.map((conversationMessage) =>
              conversationMessage.id === assistantMessageId
                ? { ...conversationMessage, content: `${conversationMessage.content}${chunk}` }
                : conversationMessage
            ),
          }));
        },
        {
          context: [
            buildContext(attachments, userProfile?.displayName),
            recentTranscript ? `Recent conversation:\n${recentTranscript}` : '',
            nextMemories.length > 0 ? `Memory:\n${nextMemories.slice(0, 8).map((entry) => `- ${entry.text}`).join('\n')}` : '',
          ].filter(Boolean).join('\n\n'),
          attachments: toAttachmentContext(attachments),
        }
      );
    } catch (error) {
      console.error('RipoAI message failed:', error);
      updateConversation(activeConversation.id, (conversation) => ({
        ...conversation,
        updatedAt: new Date().toISOString(),
        messages: conversation.messages.map((conversationMessage) =>
          conversationMessage.id === assistantMessageId
            ? {
                ...conversationMessage,
                content:
                  shouldGenerateImagePrompt(message) || shouldGenerateVideoPrompt(message)
                    ? 'I could not finish that media generation just then. Try again in a moment with a shorter prompt.'
                    : 'I hit a reply error just then. Send it again in a moment and I will retry it.',
              }
            : conversationMessage
        ),
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="snaplink-ripoai-page min-h-screen text-slate-950 dark:text-white">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <AnimatePresence>
          {showSidebar && !isDesktop && (
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-slate-950/55 backdrop-blur-sm"
              onClick={() => setShowSidebar(false)}
              aria-label="Close conversations"
            />
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {(showSidebar || isDesktop) && (
            <motion.aside
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="snaplink-ripoai-sidebar fixed inset-y-0 left-0 z-40 flex w-[min(22rem,94vw)] flex-col px-4 py-4 shadow-2xl lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:w-[21rem] lg:shadow-none"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/90 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <Logo className="h-10 w-10" animate={false} />
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-500">RipoAI 1o</div>
                    <div className="text-lg font-black tracking-tight">Conversations</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSidebar(false)}
                  className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900 lg:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={createNewConversation}
                className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-[18px] bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <Plus className="h-4 w-4" />
                Start a new chat
              </button>

              <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
                {conversations.map((conversation) => {
                  const latestMessage = conversation.messages[conversation.messages.length - 1];
                  const isActive = activeConversation?.id === conversation.id;

                  return (
                    <div
                      key={conversation.id}
                      className={`group rounded-[20px] border px-3 py-3 transition ${
                        isActive
                          ? 'border-blue-200 bg-blue-50/90 text-blue-700 shadow-sm dark:border-blue-500/25 dark:bg-blue-500/12 dark:text-blue-100'
                          : 'border-slate-200/90 bg-white/90 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-200 dark:hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveConversationId(conversation.id);
                            setShowSidebar(false);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate text-sm font-bold">{conversation.title}</div>
                          <div className="mt-1 truncate text-xs opacity-75">
                            {latestMessage?.content || 'Start a fresh chat'}
                          </div>
                          <div className="mt-2 text-[11px] font-medium opacity-60">
                            {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteConversation(conversation.id)}
                          className="rounded-full p-2 opacity-70 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-500/10"
                          aria-label={`Delete ${conversation.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <div className="snaplink-ripoai-main flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-[rgba(248,250,252,0.88)] backdrop-blur-xl dark:border-slate-800 dark:bg-[rgba(2,6,23,0.88)]">
            <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowSidebar((prev) => !prev)}
                  className="rounded-full border border-slate-200 p-2 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <Link
                  to="/"
                  className="rounded-full border border-slate-200 p-2 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-500">RipoAI 1o</div>
                  <h1 className="truncate text-xl font-black tracking-tight">Assistant</h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSidebar(true)}
                  className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900 lg:inline-flex"
                >
                  Chats
                </button>
                <button
                  type="button"
                  onClick={createNewConversation}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500"
                >
                  <Plus className="h-4 w-4" />
                  New chat
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-[1100px] min-w-0 flex-1 flex-col px-3 pb-32 pt-4 sm:px-4">
            {activeConversation?.messages.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-1 flex-col justify-center">
                <div className="mx-auto w-full max-w-[820px] rounded-[28px] border border-slate-200/90 bg-white/94 px-5 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/92">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
                      <Bot className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-500">RipoAI 1o</div>
                      <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Ask, upload, and get an answer fast.</h2>
                    </div>
                  </div>

                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
                    Send a question, a screenshot, code, or a rough idea. RipoAI stays in one clean chat flow, handles images when you upload them, and formats code clearly when the answer needs it.
                  </p>

                  <div className="mt-8 grid gap-3 md:grid-cols-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendMessage(prompt)}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/25 dark:hover:bg-blue-500/10 dark:hover:text-blue-100"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-1 flex-col gap-5">
                {activeConversation?.messages.map((message) => {
                  const isUser = message.role === 'user';

                  return (
                    <motion.div key={message.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex w-full max-w-[min(100%,56rem)] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className="shrink-0">
                          {isUser ? (
                            <Avatar src={userProfile?.photoURL} alt={userProfile?.displayName} className="h-10 w-10" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
                              <Bot className="h-5 w-5" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className={`mb-2 flex items-center gap-2 text-xs font-semibold ${isUser ? 'justify-end text-slate-500 dark:text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {!isUser && <span>RipoAI 1o</span>}
                            <span>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span>
                          </div>

                          <div
                            className={`rounded-[24px] px-4 py-4 shadow-sm ${
                              isUser
                                ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                                : 'border border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white'
                            }`}
                          >
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                                {message.attachments.map((attachment) => (
                                  <div
                                    key={attachment.id}
                                    className={`overflow-hidden rounded-2xl border ${
                                      isUser
                                        ? 'border-white/12 bg-white/10 dark:border-slate-700 dark:bg-slate-900/70'
                                        : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/84'
                                    }`}
                                  >
                                    {attachment.previewUrl && attachment.kind === 'image' ? (
                                      <img src={attachment.previewUrl} alt={attachment.name} className="h-36 w-full object-cover" />
                                    ) : null}
                                    {attachment.previewUrl && attachment.kind === 'video' ? (
                                      <video
                                        src={attachment.previewUrl}
                                        className="h-44 w-full bg-slate-950 object-cover"
                                        controls
                                        loop
                                        muted
                                        playsInline
                                        preload="metadata"
                                      />
                                    ) : null}
                                    <div className="p-3">
                                      <div className="flex items-center gap-2">
                                        {attachment.kind === 'image' ? (
                                          <ImagePlus className="h-4 w-4" />
                                        ) : attachment.kind === 'video' ? (
                                          <Film className="h-4 w-4" />
                                        ) : (
                                          <FileText className="h-4 w-4" />
                                        )}
                                        <p className="truncate text-sm font-semibold">{attachment.name}</p>
                                      </div>
                                      <p className={`mt-1 text-xs ${isUser ? 'text-white/70 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {formatFileSize(attachment.size)} · {formatAttachmentKind(attachment.kind)}
                                      </p>
                                      {attachment.excerpt && (
                                        <p className={`mt-2 line-clamp-4 text-xs leading-5 ${isUser ? 'text-white/85 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}>
                                          {attachment.excerpt}
                                        </p>
                                      )}
                                      {(attachment.previewUrl || attachment.downloadUrl) && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {attachment.previewUrl && (
                                            <a
                                              href={attachment.previewUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                                isUser
                                                  ? 'bg-white/12 text-white hover:bg-white/20 dark:bg-slate-800 dark:hover:bg-slate-700'
                                                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/12 dark:text-blue-100 dark:hover:bg-blue-500/18'
                                              }`}
                                            >
                                              Open
                                            </a>
                                          )}
                                          {attachment.downloadUrl && (
                                            <a
                                              href={attachment.downloadUrl}
                                              download={getAttachmentDownloadName(attachment)}
                                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                                isUser
                                                  ? 'bg-white/12 text-white hover:bg-white/20 dark:bg-slate-800 dark:hover:bg-slate-700'
                                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                                              }`}
                                            >
                                              Download
                                            </a>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <RipoAIMessageContent content={message.content || (isGenerating && !isUser ? '...' : '')} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {isGenerating && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                      <Bot className="h-4 w-4 text-blue-500" />
                      RipoAI is thinking
                      <div className="flex gap-1">
                        {[0, 0.16, 0.32].map((delay, index) => (
                          <motion.span
                            key={index}
                            animate={{ y: [0, -3, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay }}
                            className="block h-1.5 w-1.5 rounded-full bg-blue-400"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={createNewConversation}
            className="fixed bottom-28 right-4 z-20 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 lg:hidden"
          >
            <Plus className="h-4 w-4" />
            New chat
          </button>

          <div className="snaplink-ripoai-composer safe-area-bottom sticky bottom-0 border-t border-slate-200/90 bg-[rgba(248,250,252,0.94)] backdrop-blur-xl dark:border-slate-800 dark:bg-[rgba(2,6,23,0.94)]">
            <div className="mx-auto max-w-[1100px] px-3 pb-3 pt-3 sm:px-4">
              {composerAttachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {composerAttachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      {attachment.kind === 'image' ? (
                        <ImagePlus className="h-4 w-4 text-fuchsia-500" />
                      ) : attachment.kind === 'video' ? (
                        <Film className="h-4 w-4 text-cyan-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-blue-500" />
                      )}
                      <span className="max-w-[12rem] truncate font-medium text-slate-700 dark:text-slate-200">{attachment.name}</span>
                      <span className="text-xs text-slate-400">{formatFileSize(attachment.size)}</span>
                      <button
                        type="button"
                        onClick={() => setComposerAttachments((prev) => prev.filter((item) => item.id !== attachment.id))}
                        className="rounded-full p-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.txt,.md,.json,.csv,.pdf,.doc,.docx,.ts,.tsx,.js,.jsx,.html,.css"
                  className="hidden"
                  onChange={handleFilesSelected}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  title="Upload files"
                >
                  <Paperclip className="h-5 w-5" />
                </button>

                <div className="min-w-0 flex-1 rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <textarea
                    rows={2}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder="Message RipoAI 1o..."
                    className="max-h-52 w-full resize-none border-none bg-transparent text-[15px] leading-7 outline-none placeholder:text-slate-400 dark:text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={(!draft.trim() && composerAttachments.length === 0) || isGenerating}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white dark:disabled:bg-slate-700"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
