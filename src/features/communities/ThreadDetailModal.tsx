import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, ShieldCheck, Trophy, X } from 'lucide-react';
import type { CommunityReplyRecord, CommunityThreadRecord, UserProfile } from '../../types/domain';
import { fetchThreadReplies, createThreadReply, voteCommunityPoll } from '../../lib/communityRepo';
import { submitCommunityReport } from '../../lib/firestoreRepo';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { Card } from '../../components/ui/Card';

interface ThreadDetailModalProps {
  open: boolean;
  onClose: () => void;
  thread: CommunityThreadRecord;
  profile: UserProfile | null;
  isVerifiedUser: boolean;
  onRequireAuth: () => void;
}

export const ThreadDetailModal: React.FC<ThreadDetailModalProps> = ({
  open,
  onClose,
  thread,
  profile,
  isVerifiedUser,
  onRequireAuth,
}) => {
  const [replies, setReplies] = useState<CommunityReplyRecord[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [voting, setVoting] = useState(false);
  const [currentPoll, setCurrentPoll] = useState(thread.poll);

  useEffect(() => {
    setCurrentPoll(thread.poll);
    if (open && thread.id) {
      void fetchThreadReplies(thread.id).then(setReplies);
    }
  }, [open, thread]);

  const handleVote = async (optionIndex: number) => {
    if (!profile) {
      onRequireAuth();
      return;
    }
    setVoting(true);
    const updated = await voteCommunityPoll({
      threadId: thread.id,
      optionIndex,
      userId: profile.uid,
      isVerifiedUser,
    });
    if (updated && updated.poll) {
      setCurrentPoll(updated.poll);
    }
    setVoting(false);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      onRequireAuth();
      return;
    }
    if (!replyText.trim()) return;

    setLoading(true);
    try {
      const created = await createThreadReply({
        threadId: thread.id,
        author: profile,
        text: replyText,
        isVerifiedUser,
      });
      setReplies((prev) => [...prev, created]);
      setReplyText('');
    } catch (err) {
      console.error('Failed to post reply:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async (replyId: string) => {
    if (!profile) {
      onRequireAuth();
      return;
    }
    try {
      await submitCommunityReport({
        reporterId: profile.uid,
        targetType: 'reply',
        targetId: replyId,
        reason: 'Community discussion report',
      });
      alert('Report submitted to moderators.');
    } catch (err) {
      console.error(err);
    }
  };

  const totalVotes = currentPoll
    ? Object.values(currentPoll.votes).reduce((a, b) => a + b, 0)
    : 0;
  const userHasVoted =
    currentPoll && profile ? currentPoll.userVotes[profile.uid] !== undefined : false;

  return (
    <Sheet open={open} onClose={onClose} title="Discussion Thread">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
        <div className="space-y-4 pb-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-raised border border-border overflow-hidden flex items-center justify-center font-semibold text-ink">
                {thread.authorAvatarUrl ? (
                  <img src={thread.authorAvatarUrl} alt={thread.authorName} className="w-full h-full object-cover" />
                ) : (
                  thread.authorName.charAt(0)
                )}
              </div>
              <div>
                <div className="text-sm font-medium text-ink">
                  {thread.authorName} <span className="text-muted text-xs">@{thread.authorHandle}</span>
                </div>
                <div className="text-xs text-muted">
                  {new Date(
                    (thread.createdAt as { seconds?: number } | undefined)?.seconds
                      ? (thread.createdAt as { seconds: number }).seconds * 1000
                      : String(thread.createdAt || Date.now()),
                  ).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface-raised border border-border text-brass uppercase">
              {thread.category.replace('_', ' ')}
            </span>
          </div>

          <h2 className="text-xl font-display font-semibold text-ink">{thread.title}</h2>
          <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{thread.body}</p>

          {thread.photoUrl && (
            <div className="rounded-xl overflow-hidden border border-border max-h-80 bg-bg">
              <img src={thread.photoUrl} alt={thread.title} className="w-full h-full object-cover" />
            </div>
          )}

          {currentPoll && (
            <div className="p-4 rounded-xl bg-surface-raised border border-border space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <Trophy className="w-4 h-4 text-brass" />
                <span>{currentPoll.question}</span>
              </div>
              <div className="space-y-2">
                {currentPoll.options.map((opt, idx) => {
                  const count = currentPoll.votes[String(idx)] || 0;
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  const isSelected = profile && currentPoll.userVotes[profile.uid] === idx;

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={voting || userHasVoted || !profile}
                      onClick={() => handleVote(idx)}
                      className={`w-full text-left p-3 rounded-xl border transition-all relative overflow-hidden cursor-pointer ${
                        isSelected
                          ? 'border-brass bg-brass/10 text-ink font-medium'
                          : 'border-border bg-surface text-ink hover:border-brass/50'
                      }`}
                    >
                      <div
                        className="absolute inset-0 bg-brass/15 transition-all duration-500 pointer-events-none"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center justify-between text-sm">
                        <span>{opt}</span>
                        <span className="text-xs font-semibold text-muted">
                          {count} ({pct}%)
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-base font-display font-semibold text-ink">
            Replies ({replies.length})
          </h3>
          {replies.length === 0 ? (
            <p className="text-sm text-muted italic">No replies yet. Start the conversation below.</p>
          ) : (
            <div className="space-y-3">
              {replies.map((reply) => (
                <div key={reply.id} className="p-4 rounded-xl bg-surface-raised border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-surface border border-border overflow-hidden flex items-center justify-center text-xs font-semibold text-ink">
                        {reply.authorAvatarUrl ? (
                          <img src={reply.authorAvatarUrl} alt={reply.authorName} className="w-full h-full object-cover" />
                        ) : (
                          reply.authorName.charAt(0)
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-ink">
                          {reply.authorName} <span className="text-muted">@{reply.authorHandle}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReport(reply.id)}
                      className="text-xs text-muted hover:text-danger cursor-pointer"
                    >
                      Report
                    </button>
                  </div>
                  <p className="text-sm text-ink leading-relaxed">{reply.text}</p>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSendReply} className="pt-4 border-t border-border space-y-3">
            <textarea
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={profile ? 'Write a reply...' : 'Sign in to join the discussion...'}
              className="w-full px-4 py-3 rounded-xl bg-surface-raised border border-border text-ink placeholder:text-muted focus:outline-none focus:border-brass text-sm resize-none"
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={loading || !replyText.trim()}>
                {loading ? 'Posting...' : 'Post reply'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Sheet>
  );
};
