import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Check, ExternalLink, Sparkles, User, Award, MessageSquare } from 'lucide-react';
import { CATEGORIES } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../lib/interactionRepo';
import type { NotificationRecord } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { EmptyState } from '../../components/ui/EmptyState';

export const NotificationsPage: React.FC = () => {
  const { firebaseUser, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const uid = firebaseUser?.uid || '';
  const isVerified = Boolean(firebaseUser?.emailVerified);

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifs = async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    try {
      const list = await fetchUserNotifications(uid, isVerified);
      setNotifications(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!firebaseUser) {
      setLoading(false);
      return;
    }
    void loadNotifs();
  }, [firebaseUser, uid, isVerified]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleOpenNotif = async (n: NotificationRecord) => {
    if (!n.read) {
      await markNotificationRead({ notificationId: n.id, isVerifiedUser: isVerified });
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)),
      );
    }
    if (n.itemId) {
      navigate(`/i/${n.itemId}`);
    } else if (n.type === 'follow' || n.type === 'collector_alert') {
      navigate('/matches');
    } else {
      navigate('/explore');
    }
  };

  const handleMarkAllRead = async () => {
    if (!uid) return;
    try {
      for (const n of notifications) {
        if (!n.read) {
          await markNotificationRead({ notificationId: n.id, isVerifiedUser: isVerified });
        }
      }
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch {
      // ignore
    }
  };

  if (!firebaseUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-16">
        <EmptyState
          icon={<Bell className="w-8 h-8" strokeWidth={1.5} />}
          title="Sign in to view notifications"
          description="Track your Want List alerts, identification corrections and community activity."
          action={<Button onClick={openAuthModal}>Sign in</Button>}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-display font-semibold text-ink">Notifications</h1>
          <p className="text-sm text-muted mt-1">
            Want List matches, identification updates and alerts from the community.
          </p>
        </div>
        {notifications.length > 0 && unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={handleMarkAllRead}>
            <Check className="w-4 h-4 text-brass" />
            <span>Mark all as read</span>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-surface animate-pulse border border-border" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-8 h-8" strokeWidth={1.5} />}
          title="No notifications yet"
          description="Add pieces to your Want List or publish your collection to receive community alerts here."
          action={
            <div className="flex items-center gap-3">
              <Link to="/wantlist">
                <Button variant="secondary">Manage Want List</Button>
              </Link>
              <Link to="/explore">
                <Button>Explore pieces</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const cat = CATEGORIES[n.itemCategory];
            return (
              <div
                key={n.id}
                onClick={() => void handleOpenNotif(n)}
                className={`p-5 rounded-2xl border transition-colors cursor-pointer space-y-2 ${
                  n.read
                    ? 'bg-surface border-border text-muted hover:border-brass/40'
                    : 'bg-brass/10 border-brass/50 text-ink'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-mono text-brass">
                    {cat ? <CategoryIcon category={n.itemCategory} className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>{cat?.shortLabel || 'Alert'}</span>
                  </span>
                  {!n.read && (
                    <span className="px-2 py-0.5 rounded-full bg-brass text-brass-fg font-mono text-[10px] font-bold">
                      New
                    </span>
                  )}
                </div>

                <div className="font-display font-semibold text-base text-ink">{n.title}</div>
                <p className="text-sm text-muted leading-relaxed">{n.message}</p>

                <div className="pt-2 flex items-center justify-between text-xs font-mono text-brass">
                  <span>{n.itemId ? 'View piece' : 'View details'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
