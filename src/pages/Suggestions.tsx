import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, increment, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Lightbulb, MessageCircle, Send, Sparkles, ThumbsUp } from 'lucide-react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { LevelBadge } from '../components/ui/LevelBadge';
import { VerificationBadge, UserBadges } from '../components/ui/VerificationBadge';

type SuggestionRecord = {
  id: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorPhotoURL?: string | null;
  authorLevel?: number;
  authorBadges?: any[];
  authorHiddenBadges?: string[];
  authorIsVerified?: boolean;
  votesCount: number;
  commentsCount: number;
  status: 'open' | 'planned' | 'shipped';
  createdAt?: any;
};

export function Suggestions() {
  const { userProfile } = useAuth();
  const [suggestions, setSuggestions] = useState<SuggestionRecord[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentPostingId, setCommentPostingId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, 'suggestions'), orderBy('createdAt', 'desc')), (snapshot) => {
      setSuggestions(snapshot.docs.map((suggestionDoc) => ({ id: suggestionDoc.id, ...suggestionDoc.data() } as SuggestionRecord)));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeSuggestionId) return;

    const unsubscribe = onSnapshot(
      query(collection(db, `suggestions/${activeSuggestionId}/comments`), orderBy('createdAt', 'asc')),
      (snapshot) => {
        setCommentsMap((prev) => ({
          ...prev,
          [activeSuggestionId]: snapshot.docs.map((commentDoc) => ({ id: commentDoc.id, ...commentDoc.data() })),
        }));
      }
    );

    return () => unsubscribe();
  }, [activeSuggestionId]);

  const featuredSuggestion = suggestions[0] || null;

  const statusClassMap = useMemo(
    () => ({
      open: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
      planned: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
      shipped: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    }),
    []
  );

  const handleCreateSuggestion = async () => {
    if (!userProfile || !draftTitle.trim() || !draftBody.trim() || posting) return;

    setPosting(true);
    try {
      const suggestionRef = doc(collection(db, 'suggestions'));
      await setDoc(suggestionRef, {
        id: suggestionRef.id,
        title: draftTitle.trim(),
        body: draftBody.trim(),
        authorId: userProfile.uid,
        authorName: userProfile.displayName,
        authorUsername: userProfile.username,
        authorPhotoURL: userProfile.photoURL || null,
        authorLevel: userProfile.level || 1,
        authorBadges: userProfile.badges || [],
        authorHiddenBadges: userProfile.hiddenBadges || [],
        authorIsVerified: Boolean(userProfile.isVerified),
        votesCount: 1,
        commentsCount: 0,
        status: 'open',
        createdAt: new Date().toISOString(),
      });

      await setDoc(doc(db, `suggestions/${suggestionRef.id}/votes`, userProfile.uid), {
        userId: userProfile.uid,
        createdAt: new Date().toISOString(),
      });

      setDraftTitle('');
      setDraftBody('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'suggestions');
    } finally {
      setPosting(false);
    }
  };

  const handleVote = async (suggestion: SuggestionRecord) => {
    if (!userProfile) return;
    const voteRef = doc(db, `suggestions/${suggestion.id}/votes`, userProfile.uid);

    try {
      await setDoc(voteRef, {
        userId: userProfile.uid,
        createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'suggestions', suggestion.id), {
        votesCount: increment(1),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `suggestions/${suggestion.id}`);
    }
  };

  const handleComment = async (suggestionId: string) => {
    if (!userProfile || !commentDrafts[suggestionId]?.trim() || commentPostingId === suggestionId) return;

    setCommentPostingId(suggestionId);
    try {
      await addDoc(collection(db, `suggestions/${suggestionId}/comments`), {
        text: commentDrafts[suggestionId].trim(),
        authorId: userProfile.uid,
        authorName: userProfile.displayName,
        authorUsername: userProfile.username,
        authorPhotoURL: userProfile.photoURL || null,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'suggestions', suggestionId), {
        commentsCount: increment(1),
      });
      setCommentDrafts((prev) => ({ ...prev, [suggestionId]: '' }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `suggestions/${suggestionId}/comments`);
    } finally {
      setCommentPostingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 dark:bg-slate-950 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/96 backdrop-blur-xl dark:border-gray-800 dark:bg-slate-950/96">
        <div className="snaplink-feed-shell py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-500">Community board</p>
          <h1 className="text-[1.35rem] font-black tracking-tight text-gray-900 dark:text-white sm:text-2xl">Suggestions</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Pitch what SnapLink should ship next, vote on the best ideas, and keep the launch roadmap visible.</p>
        </div>
      </div>

      <div className="snaplink-feed-shell grid gap-4 py-4 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-[26px] border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-3">
              <Avatar src={userProfile?.photoURL} alt={userProfile?.displayName} />
              <div className="flex-1 space-y-3">
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="What should SnapLink build next?"
                  className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-[15px] font-semibold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
                <textarea
                  value={draftBody}
                  onChange={(event) => setDraftBody(event.target.value)}
                  placeholder="Pitch the idea, explain why it matters, and tell the team how it should feel."
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    Suggestions shape the roadmap
                  </div>
                  <Button
                    onClick={handleCreateSuggestion}
                    disabled={!draftTitle.trim() || !draftBody.trim() || posting}
                    className="rounded-full bg-blue-500 px-5 text-white hover:bg-blue-600"
                  >
                    {posting ? 'Posting...' : 'Post Suggestion'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {suggestions.map((suggestion, index) => {
            const suggestionComments = commentsMap[suggestion.id] || [];
            const isExpanded = activeSuggestionId === suggestion.id;
            return (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-[24px] border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start gap-3">
                  <Avatar src={suggestion.authorPhotoURL} alt={suggestion.authorName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-bold text-gray-900 dark:text-white">{suggestion.authorName}</span>
                      {suggestion.authorIsVerified && <VerificationBadge className="h-4 w-4" />}
                      <UserBadges badges={suggestion.authorBadges} hiddenBadges={suggestion.authorHiddenBadges} badgeSize="w-4 h-4" />
                      <LevelBadge level={suggestion.authorLevel || 1} compact />
                      <span className="text-xs text-gray-500 dark:text-gray-400">@{suggestion.authorUsername}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${statusClassMap[suggestion.status]}`}>{suggestion.status}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-black tracking-tight text-gray-900 dark:text-white">{suggestion.title}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">{suggestion.body}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleVote(suggestion)}
                        className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                      >
                        <ThumbsUp className="h-4 w-4" />
                        {suggestion.votesCount}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSuggestionId(isExpanded ? null : suggestion.id)}
                        className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <MessageCircle className="h-4 w-4" />
                        {suggestion.commentsCount}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 rounded-[22px] border border-gray-200 bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-950/60">
                        <div className="space-y-3">
                          {suggestionComments.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No discussion yet. Kick off the thread.</p>
                          ) : (
                            suggestionComments.map((comment) => (
                              <div key={comment.id} className="flex gap-3 rounded-2xl bg-white px-3 py-3 dark:bg-gray-900">
                                <Avatar src={comment.authorPhotoURL} alt={comment.authorName} size="sm" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{comment.authorName}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">@{comment.authorUsername}</span>
                                  </div>
                                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{comment.text}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            value={commentDrafts[suggestion.id] || ''}
                            onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [suggestion.id]: event.target.value }))}
                            placeholder="Add your take..."
                            className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleComment(suggestion.id)}
                            disabled={!commentDrafts[suggestion.id]?.trim() || commentPostingId === suggestion.id}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-blue-500 text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-500">Featured</p>
            {featuredSuggestion ? (
              <>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-900 dark:text-white">{featuredSuggestion.title}</h2>
                <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{featuredSuggestion.body}</p>
                <div className="mt-4 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <span>{featuredSuggestion.votesCount} votes</span>
                  <span>{featuredSuggestion.commentsCount} comments</span>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Fresh feature ideas will appear here once the board starts moving.</p>
            )}
          </div>

          <div className="rounded-[28px] border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-500">How it works</p>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
              <li>Post a clean idea with enough detail that the team can actually build it.</li>
              <li>Vote on the strongest suggestions so the best requests rise naturally.</li>
              <li>Use the thread to refine the feature instead of spamming duplicates.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
