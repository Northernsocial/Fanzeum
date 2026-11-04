import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, Flame, Sparkles, Trophy, UserCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  calculateLevel,
  fetchCollectorJourney,
  fetchWeeklyChallenges,
  LEVEL_THRESHOLDS,
} from '../../lib/journeyRepo';
import type { CollectorJourneyRecord, WeeklyChallengeRecord } from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { CATEGORIES } from '../../config/categories';

export const CollectorJourneyPage: React.FC = () => {
  const { firebaseUser, profile } = useAuth();
  const uid = firebaseUser?.uid;

  useDocumentMeta({
    title: 'Collector Journey & Badges · Fanzeum',
    description: 'Track your collector level, XP milestones, weekly challenges and mentorship status.',
  });

  const [journey, setJourney] = useState<CollectorJourneyRecord | null>(null);
  const [challenges, setChallenges] = useState<WeeklyChallengeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!uid) {
        setLoading(false);
        return;
      }
      try {
        const [jData, cData] = await Promise.all([
          fetchCollectorJourney(uid),
          fetchWeeklyChallenges(),
        ]);
        if (!active) return;
        setJourney(jData);
        setChallenges(cData);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [uid]);

  if (!firebaseUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-3xl font-display font-semibold text-ink">Collector Journey</h1>
        <p className="text-muted">Sign in to track your collector level, XP milestones and badges.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12 space-y-8">
        <Skeleton className="h-48" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const xp = journey?.xp || 10;
  const level = journey?.level || calculateLevel(xp);
  const badges = journey?.badges || ['Founding Collector'];

  const currentLevelObj = LEVEL_THRESHOLDS.find((t) => t.level === level) || LEVEL_THRESHOLDS[0];
  const nextLevelObj =
    LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.findIndex((t) => t.level === level) + 1] || currentLevelObj;
  const xpNeeded = nextLevelObj.minXp - currentLevelObj.minXp;
  const xpProgress = xp - currentLevelObj.minXp;
  const pct = xpNeeded > 0 ? Math.min(100, Math.round((xpProgress / xpNeeded) * 100)) : 100;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-10">
      {/* Journey Banner */}
      <Card raised className="p-6 sm:p-8 space-y-6 after-hours-spotlight">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-brass">
              <Trophy className="w-4 h-4" strokeWidth={1.5} />
              <span>Collector Rank & XP</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink">
              {level} Collector
            </h1>
            <p className="text-base text-muted">
              {profile?.displayName || 'Collector'} · {xp} XP total earned across showcase additions and community contributions.
            </p>
          </div>

          <div className="bg-surface-raised border border-border rounded-2xl p-4 text-center shrink-0 min-w-[160px]">
            <div className="text-xs text-muted">Current Rank</div>
            <div className="text-2xl font-display font-bold text-brass mt-0.5">{level}</div>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex justify-between text-xs font-mono text-muted">
            <span>Level Progress ({pct}%)</span>
            <span>
              {xp} / {nextLevelObj.minXp} XP {level === 'Legend' ? '(Max Rank)' : `to ${nextLevelObj.level}`}
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-surface overflow-hidden border border-border">
            <div
              className="h-full bg-brass transition-all duration-500 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Badges Earned */}
      <div className="space-y-4">
        <h2 className="text-2xl font-display font-semibold text-ink">Milestone Badges ({badges.length})</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {badges.map((badgeName) => (
            <Card key={badgeName} className="p-5 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-brass/10 border border-brass/30 text-brass flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink truncate">{badgeName}</div>
                <div className="text-xs text-brass font-mono">Unlocked</div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Weekly Challenges */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-display font-semibold text-ink">Weekly Category Challenges</h2>
          <span className="text-xs font-mono text-brass">Earn XP & Rank Up</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {challenges.map((ch) => {
            const catConfig = CATEGORIES[ch.category];
            return (
              <Card key={ch.id} className="p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-brass">
                    <span>{ch.weekLabel}</span>
                    <span>+{ch.rewardXp} XP</span>
                  </div>
                  <h3 className="text-lg font-display font-semibold text-ink">{ch.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{ch.description}</p>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted">Hobby: {catConfig?.shortLabel || ch.category}</span>
                  <Button size="sm" variant="secondary" onClick={() => window.location.assign('/add')}>
                    Start chase
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
