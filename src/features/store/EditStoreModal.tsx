import React, { useState } from 'react';
import { ShieldCheck, Store } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  adminUpdateStoreIdVerification,
  requestStoreIdVerification,
  upsertStoreProfile,
} from '../../lib/firestoreRepo';
import type { StoreProfileRecord } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';

interface EditStoreModalProps {
  open: boolean;
  onClose: () => void;
  store: StoreProfileRecord | null;
  onSaved: (updated: StoreProfileRecord) => void;
}

export const EditStoreModal: React.FC<EditStoreModalProps> = ({
  open,
  onClose,
  store,
  onSaved,
}) => {
  const { profile, firebaseUser, isAdminUser } = useAuth();

  const [businessName, setBusinessName] = useState(store?.businessName || profile?.displayName || '');
  const [businessAddress, setBusinessAddress] = useState(store?.businessAddress || '');
  const [companyNumber, setCompanyNumber] = useState(store?.companyNumber || '');
  const [about, setAbout] = useState(store?.about || profile?.bio || '');
  const [returnsPolicy, setReturnsPolicy] = useState(
    store?.returnsPolicy ||
      '14-day UK returns accepted in original condition. Buyer covers tracked return postage unless item was significantly misdescribed.',
  );
  const [logoUrl, setLogoUrl] = useState(store?.logoUrl || profile?.avatarUrl || '');
  const [bannerUrl, setBannerUrl] = useState(store?.bannerUrl || '');
  const [holidayMode, setHolidayMode] = useState(store?.holidayMode || false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !firebaseUser) return;

    if (!businessName.trim()) {
      setError('Please provide your trading or business name.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await upsertStoreProfile({
        userId: firebaseUser.uid,
        handle: profile.handle,
        businessName,
        businessAddress,
        companyNumber,
        about,
        returnsPolicy,
        logoUrl,
        bannerUrl,
        holidayMode,
        idVerificationStatus: store?.idVerificationStatus || 'unverified',
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      console.error('Save store profile error:', err);
      setError('Could not update storefront settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestIdCheck = async () => {
    if (!firebaseUser) return;
    try {
      await requestStoreIdVerification(firebaseUser.uid);
      if (store) {
        onSaved({ ...store, idVerificationStatus: 'pending' });
      }
    } catch (err) {
      console.error('Request ID check error:', err);
    }
  };

  const handleAdminStatusChange = async (status: 'approved' | 'rejected' | 'unverified') => {
    if (!firebaseUser || !store) return;
    try {
      await adminUpdateStoreIdVerification(store.userId, status);
      onSaved({ ...store, idVerificationStatus: status });
    } catch (err) {
      console.error('Admin status error:', err);
    }
  };

  const statusLabel: Record<string, string> = {
    unverified: 'Not Verified',
    pending: 'Verification Under Review',
    approved: 'Approved ✓ (Verified Store Badge Active)',
    rejected: 'Verification Rejected',
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Storefront Settings"
      subtitle="Manage your UK business details, return terms, storefront banner, and holiday mode."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Holiday Mode Toggle */}
        <div className="p-4 rounded-xl border border-brass/40 bg-brass/5 space-y-2">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-ink">Holiday Mode</div>
              <div className="text-xs text-muted">
                Temporarily pause orders and hide listings without deleting your inventory.
              </div>
            </div>
            <input
              type="checkbox"
              checked={holidayMode}
              onChange={(e) => setHolidayMode(e.target.checked)}
              className="w-5 h-5 accent-brass shrink-0"
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">
            Trading / Business Name <span className="text-brass">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={120}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Piccadilly Rare Cards Ltd"
            className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">
            UK Business / Trading Address <span className="text-brass">*</span>
          </label>
          <textarea
            rows={3}
            required
            maxLength={500}
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
            placeholder="e.g. 14 Market Street, Manchester, M1 1PT"
            className="w-full px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink resize-none"
          />
          <p className="text-xs text-muted mt-1">Required for UK distance trading compliance and Verified Store badge.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">
            UK Companies House Number <span className="text-xs text-muted">(Optional)</span>
          </label>
          <input
            type="text"
            maxLength={50}
            value={companyNumber}
            onChange={(e) => setCompanyNumber(e.target.value)}
            placeholder="e.g. 12345678"
            className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">About Your Store</label>
          <textarea
            rows={4}
            maxLength={3000}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Introduce your specialities, provenance expertise, fairs you attend, and history..."
            className="w-full px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">UK Returns Policy</label>
          <textarea
            rows={3}
            maxLength={2000}
            value={returnsPolicy}
            onChange={(e) => setReturnsPolicy(e.target.value)}
            placeholder="Details on returns, condition guarantees, and packaging standards..."
            className="w-full px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Logo URL</label>
            <input
              type="url"
              maxLength={2048}
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Banner Image URL</label>
            <input
              type="url"
              maxLength={2048}
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://..."
              className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink font-mono"
            />
          </div>
        </div>

        {/* Verification Status Card */}
        <div className="p-4 rounded-xl border border-border bg-surface-raised space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brass" strokeWidth={1.5} />
              <span className="text-sm font-medium text-ink">Seller ID Verification</span>
            </div>
            <span className="text-xs font-mono font-medium text-brass">
              {statusLabel[store?.idVerificationStatus || 'unverified']}
            </span>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            The Verified Store badge is awarded once your seller ID check is approved and business details (trading name and UK address) are provided.
          </p>

          {(!store || store.idVerificationStatus === 'unverified') && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRequestIdCheck}
            >
              Request Seller ID Verification
            </Button>
          )}

          {isAdminUser && store && (
            <div className="pt-2 border-t border-border flex flex-wrap gap-2 items-center">
              <span className="text-xs font-mono text-muted">Admin:</span>
              <button
                type="button"
                onClick={() => handleAdminStatusChange('approved')}
                className="text-xs px-2.5 py-1 rounded bg-ok/10 text-ok font-mono hover:bg-ok/20 cursor-pointer"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleAdminStatusChange('rejected')}
                className="text-xs px-2.5 py-1 rounded bg-danger/10 text-danger font-mono hover:bg-danger/20 cursor-pointer"
              >
                Reject
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save storefront'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
};
