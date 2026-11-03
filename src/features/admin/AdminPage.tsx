import React, { useEffect, useState } from 'react';
import { ShieldAlert, Users, AlertTriangle, Layers, Star, BarChart3, Search, CheckCircle2, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import {
  fetchAllReportsAdmin,
  listAllUsersAdmin,
  deleteReportAdmin,
  deleteCommentAdmin,
  setCollectionFeaturedAdmin,
  fetchPlatformStatsAdmin,
  updateUserPublicProfile,
} from '../../lib/firestoreRepo';
import type { ReportRecord, UserProfile, CollectionRecord } from '../../types/domain';
import { CATEGORIES } from '../../config/categories';

type AdminTab = 'users' | 'reports' | 'categories' | 'featured' | 'usage';

export const AdminPage: React.FC = () => {
  const { firebaseUser, profile, isAdminUser } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [stats, setStats] = useState({
    usersCount: 0,
    itemsCount: 0,
    collectionsCount: 0,
    reportsCount: 0,
  });

  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    Object.values(CATEGORIES).forEach((c: { slug: string; name: string }) => {
      map[c.slug] = c.name;
    });
    return map;
  });

  useEffect(() => {
    if (!isAdminUser) return;
    loadAdminData();
  }, [isAdminUser]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [uList, rList, st] = await Promise.all([
        listAllUsersAdmin(150),
        fetchAllReportsAdmin(),
        fetchPlatformStatsAdmin(),
      ]);
      setUsers(uList);
      setReports(rList);
      setStats(st);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (targetUid: string, newRole: UserProfile['role']) => {
    try {
      await updateUserPublicProfile(targetUid, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.uid === targetUid ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      alert('Failed to update user role: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleResolveReport = async (reportId: string, itemId?: string, targetId?: string) => {
    try {
      if (itemId && targetId) {
        await deleteCommentAdmin(itemId, targetId).catch(() => {});
      }
      await deleteReportAdmin(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err) {
      alert('Failed to resolve report: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  if (!firebaseUser || !isAdminUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="p-8 rounded-2xl border border-border bg-surface space-y-4">
          <ShieldAlert className="w-12 h-12 text-brass mx-auto" strokeWidth={1.5} />
          <h1 className="text-2xl font-display font-semibold">Restricted Area</h1>
          <p className="text-sm text-muted">
            You need admin privileges to access the back office.
          </p>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const s = userSearch.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(s) ||
      u.handle.toLowerCase().includes(s) ||
      u.uid.toLowerCase().includes(s)
    );
  });

  const categoriesList = Object.values(CATEGORIES) as Array<{ slug: string; name: string; description: string; icon: string }>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-brass text-xs font-semibold tracking-wider uppercase mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Back Office</span>
          </div>
          <h1 className="text-3xl font-display font-bold">Admin Console</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted bg-surface border border-border px-3 py-2 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Authenticated Admin</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border">
        {[
          { id: 'users', label: 'Users', icon: Users, count: users.length },
          { id: 'reports', label: 'Reports', icon: AlertTriangle, count: reports.length },
          { id: 'categories', label: 'Categories', icon: Layers, count: categoriesList.length },
          { id: 'featured', label: 'Featured', icon: Star },
          { id: 'usage', label: 'Usage & Stats', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shrink-0 cursor-pointer border ${
                isActive
                  ? 'bg-brass text-bg border-brass font-semibold shadow-sm'
                  : 'bg-surface border-border text-muted hover:text-ink hover:border-brass/40'
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={1.5} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-bg/20 text-bg' : 'bg-border text-ink'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div>
          {/* USERS TAB */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search collectors by name or handle..."
                    className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-brass"
                  />
                </div>
                <div className="text-xs text-muted">
                  Showing {filteredUsers.length} of {users.length} collectors
                </div>
              </div>

              <div className="border border-border rounded-2xl bg-surface overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-bg/50 text-xs font-semibold uppercase text-muted tracking-wider">
                        <th className="p-4">Collector</th>
                        <th className="p-4">Handle</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Pieces / Colls</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {filteredUsers.map((u) => (
                        <tr key={u.uid} className="hover:bg-bg/30 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={u.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'}
                                alt={u.displayName}
                                className="w-9 h-9 rounded-full object-cover border border-border"
                              />
                              <div>
                                <div className="font-semibold text-ink">{u.displayName}</div>
                                <div className="text-xs text-muted font-mono">{u.uid}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-muted font-mono text-xs">@{u.handle}</td>
                          <td className="p-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${
                                u.role === 'admin'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : u.role === 'expert'
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  : 'bg-border text-muted'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="p-4 text-muted">
                            {u.piecesCount} pieces ({u.collectionsCount} showcases)
                          </td>
                          <td className="p-4 text-right">
                            <select
                              value={u.role}
                              onChange={(e) =>
                                handleRoleChange(u.uid, e.target.value as UserProfile['role'])
                              }
                              className="bg-bg border border-border rounded-lg px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-brass cursor-pointer"
                            >
                              <option value="collector">Collector</option>
                              <option value="expert">Expert</option>
                              <option value="store">Store</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* REPORTS TAB */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-display font-semibold">Moderation Reports</h2>
                  <p className="text-sm text-muted">
                    Review flagged comments or items reported by the community.
                  </p>
                </div>
              </div>

              {reports.length === 0 ? (
                <EmptyState
                  title="All clear"
                  description="No moderation reports have been submitted."
                />
              ) : (
                <div className="space-y-4">
                  {reports.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-5 rounded-2xl border border-border bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            {rep.targetType}
                          </span>
                          <span className="text-xs text-muted font-mono">ID: {rep.targetId}</span>
                        </div>
                        <p className="text-sm font-medium text-ink pt-1">&ldquo;{rep.reason}&rdquo;</p>
                        <p className="text-xs text-muted">Reporter ID: {rep.reporterId}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleResolveReport(rep.id, rep.itemId, rep.targetId)}
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Dismiss / Hide</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CATEGORIES TAB */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-display font-semibold">Category Management</h2>
                <p className="text-sm text-muted">
                  View and manage default collection and item categories across Fanzeum.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoriesList.map((cat) => (
                  <div key={cat.slug} className="p-5 rounded-2xl border border-border bg-surface space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{cat.icon}</span>
                      <span className="text-xs font-mono text-muted">{cat.slug}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink">{categoryLabels[cat.slug] || cat.name}</h3>
                      <p className="text-xs text-muted line-clamp-2 mt-1">{cat.description}</p>
                    </div>
                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted">
                      <span>Status: Active</span>
                      <span className="text-brass">System default</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FEATURED TAB */}
          {activeTab === 'featured' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-display font-semibold">Featured Showcase &amp; Collections</h2>
                <p className="text-sm text-muted">
                  Highlight premier collections on the homepage and exploration feeds.
                </p>
              </div>

              <div className="p-8 rounded-2xl border border-border bg-surface text-center space-y-4">
                <Star className="w-10 h-10 text-brass mx-auto" strokeWidth={1.5} />
                <h3 className="text-lg font-semibold">Homepage Spotlights</h3>
                <p className="text-sm text-muted max-w-md mx-auto">
                  Collections marked as featured appear automatically in the curated homepage carousel. Use collection IDs to toggle featured status from collection records.
                </p>
              </div>
            </div>
          )}

          {/* USAGE & STATS TAB */}
          {activeTab === 'usage' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-display font-semibold">Platform Metrics &amp; Usage</h2>
                <p className="text-sm text-muted">
                  Real-time counters across collectors, items, showcases, and reports.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-6 rounded-2xl border border-border bg-surface space-y-2">
                  <div className="text-xs uppercase tracking-wider text-muted font-medium">Total Collectors</div>
                  <div className="text-3xl font-display font-bold text-ink">{stats.usersCount}</div>
                  <div className="text-xs text-emerald-400 font-medium">Active accounts</div>
                </div>

                <div className="p-6 rounded-2xl border border-border bg-surface space-y-2">
                  <div className="text-xs uppercase tracking-wider text-muted font-medium">Collectible Pieces</div>
                  <div className="text-3xl font-display font-bold text-ink">{stats.itemsCount}</div>
                  <div className="text-xs text-brass font-medium">Indexed catalog items</div>
                </div>

                <div className="p-6 rounded-2xl border border-border bg-surface space-y-2">
                  <div className="text-xs uppercase tracking-wider text-muted font-medium">Showcases</div>
                  <div className="text-3xl font-display font-bold text-ink">{stats.collectionsCount}</div>
                  <div className="text-xs text-blue-400 font-medium">Collector galleries</div>
                </div>

                <div className="p-6 rounded-2xl border border-border bg-surface space-y-2">
                  <div className="text-xs uppercase tracking-wider text-muted font-medium">Pending Reports</div>
                  <div className="text-3xl font-display font-bold text-ink">{stats.reportsCount}</div>
                  <div className="text-xs text-rose-400 font-medium">Needs review</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
