import React, { useState } from 'react';
import { MessageSquare, ShieldCheck, Trophy } from 'lucide-react';
import type { CommunityThreadRecord } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface CommunityThreadCardProps {
  thread: CommunityThreadRecord;
  onSelect: (thread: CommunityThreadRecord) => void;
  onVotePoll: (threadId: string, optionIndex: number) => void;
  currentUserId?: string;
}

export const CommunityThreadCard: React.FC<CommunityThreadCardProps> = ({
  thread,
  onSelect,
  onVotePoll,
  currentUserId,
}) => {
  const [votingIdx, setVotingIdx] = useState<number | null>(null);

  const totalVotes = thread.poll
    ? Object.values(thread.poll.votes).reduce((a, b) => a + b, 0)
    : 0;
  const userHasVoted =
    thread.poll && currentUserId ? thread.poll.userVotes[currentUserId] !== undefined : false;

  return (
    <Card raised interactive className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-raised border border-border overflow-hidden flex items-center justify-center text-sm font-semibold text-ink shrink-0">
            {thread.authorAvatarUrl ? (
              <img
                src={thread.authorAvatarUrl}
                alt={thread.authorName}
                className="w-full h-full object-cover"
              />
            ) : (
              thread.authorName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-medium text-sm text-ink">
              <span>{thread.authorName}</span>
              <span className="text-muted text-xs">@{thread.authorHandle}</span>
            </div>
            <span className="text-xs text-muted">
              {new Date(
                (thread.createdAt as { seconds?: number } | undefined)?.seconds
                  ? (thread.createdAt as { seconds: number }).seconds * 1000
                  : String(thread.createdAt || Date.now()),
              ).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface-raised border border-border text-brass uppercase tracking-wide">
          {thread.category.replace('_', ' ')}
        </span>
      </div>

      <div onClick={() => onSelect(thread)} className="cursor-pointer space-y-2">
        <h3 className="text-lg font-display font-semibold text-ink hover:text-brass transition-colors">
          {thread.title}
        </h3>
        <p className="text-sm text-muted line-clamp-3 leading-relaxed">{thread.body}</p>
      </div>

      {thread.photoUrl && (
        <div
          onClick={() => onSelect(thread)}
          className="rounded-xl overflow-hidden border border-border max-h-64 bg-bg cursor-pointer"
        >
          <img
            src={thread.photoUrl}
            alt={thread.title}
            className="w-full h-full object-cover hover:scale-102 transition-transform duration-200"
          />
        </div>
      )}

      {thread.poll && (
        <div className="p-4 rounded-xl bg-surface-raised border border-border space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <Trophy className="w-4 h-4 text-brass" />
            <span>{thread.poll.question}</span>
          </div>
          <div className="space-y-2">
            {thread.poll.options.map((opt, idx) => {
              const count = thread.poll?.votes[String(idx)] || 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const isSelected = currentUserId && thread.poll?.userVotes[currentUserId] === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={userHasVoted || !currentUserId}
                  onClick={() => {
                    setVotingIdx(idx);
                    onVotePoll(thread.id, idx);
                  }}
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
          {!currentUserId && (
            <p className="text-xs text-muted text-center italic">Sign in to vote in this poll.</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border text-sm text-muted">
        <button
          type="button"
          onClick={() => onSelect(thread)}
          className="inline-flex items-center gap-1.5 hover:text-ink cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>{thread.replyCount} replies</span>
        </button>
        <Button size="sm" variant="secondary" onClick={() => onSelect(thread)}>
          Join discussion
        </Button>
      </div>
    </Card>
  );
};
