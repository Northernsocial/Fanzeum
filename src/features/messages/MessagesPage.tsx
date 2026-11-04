import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Send, ShieldAlert, UserX } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  blockUser,
  isUserBlocked,
  listConversationMessages,
  listUserConversations,
  sendDirectMessage,
} from '../../lib/firestoreRepo';
import type { ConversationRecord, DirectMessageRecord } from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';

export const MessagesPage: React.FC = () => {
  const { firebaseUser, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const activeConvParam = searchParams.get('c');

  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(activeConvParam);
  const [messages, setMessages] = useState<DirectMessageRecord[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  useDocumentMeta({
    title: 'Messages & Collector Chat',
    description: 'Direct conversations between collectors on Fanzeum.',
  });

  const loadConversations = async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const list = await listUserConversations(firebaseUser.uid);
      setConversations(list);
      if (!activeConvId && list.length > 0) {
        setActiveConvId(list[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      void loadConversations();
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (activeConvParam) {
      setActiveConvId(activeConvParam);
    }
  }, [activeConvParam]);

  useEffect(() => {
    if (!activeConvId || !firebaseUser) {
      setMessages([]);
      return;
    }
    let active = true;
    async function loadMsgs() {
      try {
        const msgs = await listConversationMessages(activeConvId!);
        if (!active) return;
        setMessages(msgs);

        const conv = conversations.find((c) => c.id === activeConvId);
        if (conv && profile) {
          const otherId = conv.participantIds.find((id) => id !== firebaseUser?.uid);
          if (otherId) {
            const blocked = await isUserBlocked(firebaseUser.uid, otherId);
            if (active) setIsBlocked(blocked);
          }
        }
      } catch {
        // ignore
      }
    }
    void loadMsgs();
    const interval = setInterval(() => {
      void loadMsgs();
    }, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeConvId, firebaseUser?.uid]);

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const otherIdx = activeConv ? activeConv.participantIds.findIndex((id) => id !== firebaseUser?.uid) : -1;
  const otherName = otherIdx !== -1 && activeConv ? activeConv.participantNames[otherIdx] : 'Collector';
  const otherHandle = otherIdx !== -1 && activeConv ? activeConv.participantHandles[otherIdx] : 'collector';
  const otherAvatar = otherIdx !== -1 && activeConv ? activeConv.participantAvatarUrls[otherIdx] : '';
  const otherUid = otherIdx !== -1 && activeConv ? activeConv.participantIds[otherIdx] : '';

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !profile || !inputText.trim() || sending || isBlocked) return;
    setSending(true);
    try {
      await sendDirectMessage({
        conversationId: activeConvId,
        senderProfile: profile,
        text: inputText,
      });
      setInputText('');
      const msgs = await listConversationMessages(activeConvId);
      setMessages(msgs);
    } finally {
      setSending(false);
    }
  };

  const handleBlock = async () => {
    if (!firebaseUser || !otherUid) return;
    await blockUser(firebaseUser.uid, otherUid);
    setIsBlocked(true);
  };

  if (!firebaseUser) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          title="Sign in required"
          description="Sign in to view your direct messages with other collectors."
          action={<Button onClick={() => window.location.href = '/showcase'}>Sign in</Button>}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[72vh] min-h-[500px]">
        {/* Left: Conversations List */}
        <Card className="lg:col-span-4 flex flex-col overflow-hidden p-0">
          <div className="p-4 border-b border-border bg-surface-raised flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brass" strokeWidth={1.5} />
              <h1 className="text-lg font-display font-semibold text-ink">Messages</h1>
            </div>
            <span className="text-xs font-mono text-muted">{conversations.length} chats</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            െ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">
                No direct messages yet. Start a chat from any collector profile or piece.
              </div>
            ) : (
              conversations.map((c) => {
                const idx = c.participantIds.findIndex((id) => id !== firebaseUser.uid);
                const name = idx !== -1 ? c.participantNames[idx] : 'Collector';
                const handle = idx !== -1 ? c.participantHandles[idx] : 'collector';
                const avatar = idx !== -1 ? c.participantAvatarUrls[idx] : '';
                const active = c.id === activeConvId;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveConvId(c.id)}
                    className={`w-full text-left p-4 flex items-center gap-3 transition-colors cursor-pointer ${
                      active ? 'bg-brass/10 border-l-2 border-brass' : 'hover:bg-surface-raised'
                    }`}
                  >
                    <CollectorImage
                      src={avatar}
                      alt={name}
                      className="w-10 h-10 rounded-full border border-border shrink-0 bg-surface-raised"
                      imgClassName="w-full h-full object-cover rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-ink truncate">{name}</span>
                        <span className="text-xs font-mono text-muted">@{handle}</span>
                      </div>
                      <p className="text-xs text-muted truncate mt-0.5">{c.lastMessageText}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Right: Active Conversation Chat */}
        <Card className="lg:col-span-8 flex flex-col overflow-hidden p-0">
          {activeConv ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border bg-surface-raised flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CollectorImage
                    src={otherAvatar}
                    alt={otherName}
                    className="w-9 h-9 rounded-full border border-border shrink-0 bg-surface-raised"
                    imgClassName="w-full h-full object-cover rounded-full"
                  />
                  <div>
                    <div className="text-sm font-semibold text-ink">{otherName}</div>
                    <div className="text-xs font-mono text-muted">@{otherHandle}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBlock}
                    className="text-muted hover:text-danger text-xs"
                  >
                    <UserX className="w-4 h-4" strokeWidth={1.5} />
                    <span>{otherUid && isBlocked ? 'Blocked' : 'Block user'}</span>
                  </Button>
                </div>
              </div>

              {/* Messages scroll */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {activeConv.itemTitle && (
                  <div className="p-3 rounded-xl bg-surface-raised border border-border flex items-center gap-3 text-xs max-w-md mx-auto mb-4">
                    {activeConv.itemThumbUrl && (
                      <img
                        src={activeConv.itemThumbUrl}
                        alt={activeConv.itemTitle}
                        className="w-12 h-12 rounded object-cover border border-border"
                      />
                    )}
                    <div>
                      <div className="text-muted">Chat regarding piece:</div>
                      <div className="font-medium text-ink">{activeConv.itemTitle}</div>
                    </div>
                  </div>
                )}

                {messages.map((m) => {
                  const isMe = m.senderId === firebaseUser.uid;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMe
                            ? 'bg-brass text-brass-fg rounded-br-sm'
                            : 'bg-surface-raised border border-border text-ink rounded-bl-sm'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              {isBlocked ? (
                <div className="p-4 border-t border-border bg-surface-raised text-center text-sm text-danger flex items-center justify-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  <span>You have blocked this user. Messages cannot be sent.</span>
                </div>
              ) : (
                <form onSubmit={handleSend} className="p-3 sm:p-4 border-t border-border bg-surface flex items-center gap-3">
                  <input
                    type="text"
                    required
                    maxLength={1000}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Write a message…"
                    className="flex-1 min-h-[44px] px-4 py-2 text-base rounded-xl border border-border bg-bg text-ink focus:outline-none focus:border-brass/70"
                  />
                  <Button type="submit" disabled={sending || !inputText.trim()}>
                    <Send className="w-4 h-4" strokeWidth={1.5} />
                    <span>Send</span>
                  </Button>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-muted text-sm">
              Select a conversation from the left to start chatting.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
