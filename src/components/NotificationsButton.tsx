import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ExternalLink, Sparkles } from 'lucide-react';
import { CATEGORIES } from '../config/categories';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchUserNotifications,
  markNotificationRead,
} from '../lib/interactionRepo';
import type { NotificationRecord } from '../types/domain';
import { Button } from './ui/Button';
import { CategoryIcon } from './ui/CategoryIcon';
import { EmptyState } from './ui/EmptyState';
import { Sheet } from './ui/Sheet';

export const NotificationsButton: React.FC = () => {
  const { firebaseUser, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const uid = firebaseUser?.uid || 'guest_user';
  const isVerified = Boolean(firebaseUser?.emailVerified);

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [open, setOpen] = useState(false);

  const loadNotifs = async () => {
    if (!uid) return;
    try {
      const list = await fetchUserNotifications(uid, isVerified);
      setNotifications(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadNotifs();
    const interval = setInterval(() => {
      void loadNotifs();
    }, 20000);
    return () => clearInterval(interval);
  }, [uid, isVerified]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleOpenNotif = async (n: NotificationRecord) => {
    if (!n.read) {
      await markNotificationRead({ notificationId: n.id, isVerifiedUser: isVerified });
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)),
      );
    }
    setOpen(false);
    navigate(`/i/${n.itemId}`);
  };

  const handleMarkAllRead = async () => {
    for (const n of notifications) {
      if (!n.read) {
        await markNotificationRead({ notificationId: n.id, isVerifiedUser: isVerified });
      }
    }
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!firebaseUser) {
            openAuthModal();
            return;
          }
          setOpen(true);
        }}
        aria-label={`Notifications (${unreadCount} unread)`}
        className="relative min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-border bg-surface text-muted hover:text-ink hover:border-brass/50 transition-colors cursor-pointer"
      >
        <Bell className="w-4 h-4" strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brass text-[10px] font-bold text-brass-fg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Notifications"
        subtitle="Want alerts and identification updates from the community."
      >
        <div className="space-y-4">
          {notifications.length > 0 && unreadCount > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-brass hover:underline font-mono cursor-pointer"
              >
                Mark all as read
              </button>
            </div>
          )}

          {notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-6 h-6" strokeWidth={1.5} />}
              title="No notifications yet"
              description="Add pieces to your Wantlist. You'll get an alert here when a matching Fresh Find is catalogued."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setOpen(false);
                    navigate('/wantlist');
                  }}
                >
                  Manage Wantlist
                </Button>
              }
            />
          ) : (
            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {notifications.map((n) => {
                const cat = CATEGORIES[n.itemCategory];
                return (
                  <div
                    key={n.id}
                    onClick={() => void handleOpenNotif(n)}
                    className={`p-3.5 rounded-xl border transition-colors cursor-pointer space-y-1.5 ${
                      n.read
                        ? 'bg-surface border-border text-muted hover:border-brass/40'
                        : 'bg-brass/10 border-brass/50 text-ink'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 font-mono text-brass">
                        <CategoryIcon category={n.itemCategory} className="w-3 h-3" />
                        <span>{cat?.shortLabel || n.itemCategory}</span>
                      </span>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-brass shrink-0" title="Unread" />
                      )}
                    </div>

                    <div className="font-medium text-sm text-ink">{n.title}</div>
                    <p className="text-xs text-muted leading-relaxed">{n.message}</p>

                    <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-brass">
                      <span>View piece</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
};
