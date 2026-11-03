import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  FolderPlus,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Lock,
  Plus,
  RotateCw,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { CATEGORIES, CATEGORY_LIST, isPanelConfirmed, type CategorySlug } from '../../config/categories';
import {
  ALL_PERSONAS,
  getPersonaById,
  LEAD_APPRAISER_PERSONA,
  type PersonaConfig,
} from '../../config/panel';
import { useAuth } from '../../contexts/AuthContext';
import { sendPanelChatTurn, type IdentifyPhotoPayload } from '../../lib/aiClient';
import { formatGbpRange } from '../../lib/entitlements';
import { getFriendlyFirebaseErrorMessage } from '../../lib/firebase';
import {
  addCollectibleItemRecord,
  createCollectionRecord,
  createFreshFindRecord,
  listOwnerCollections,
  makeSafeId,
  upsertPanelChatRecord,
} from '../../lib/firestoreRepo';
import { checkAndTriggerWantAlerts } from '../../lib/interactionRepo';
import {
  processCollectiblePhoto,
  uploadProcessedItemPhoto,
  type ProcessedCollectiblePhoto,
} from '../../lib/imageUtils';
import type {
  AIConfidence,
  CollectionRecord,
  ConfidenceLevel,
  PanelCard,
  PanelChatMessage,
} from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { ConfidenceChip } from '../../components/ui/ConfidenceChip';

interface StagedSlot {
  id: string;
  file: File;
  label: string;
  rotationDeg: 0 | 90 | 180 | 270;
  processed: ProcessedCollectiblePhoto;
}

export const AddPiecePage: React.FC = () => {
  const { firebaseUser, profile, openAuthModal, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedColId = searchParams.get('collectionId') || '';

  useDocumentMeta({
    title: 'AI Expert Panel Chat · Fanzeum',
    description:
      'Chat directly with specialist AI personas (The Philatelist, The Numismatist, The Card Grader, etc.) to identify your piece and build your showcase card.',
  });

  // Persistent itemId for the session
  const [chatItemId] = useState(() => makeSafeId('item_chat'));

  // Step state: 'setup' (photos upload) -> 'chat' (interactive expert panel & live card)
  const [panelStarted, setPanelStarted] = useState(false);

  // Photos state
  const [slots, setSlots] = useState<StagedSlot[]>([]);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Panel chat state
  const [messages, setMessages] = useState<PanelChatMessage[]>([]);
  const [currentCard, setCurrentCard] = useState<PanelCard | null>(null);
  const [rollingSummary, setRollingSummary] = useState('');
  const [activePersonaId, setActivePersonaId] = useState<string>('lead');
  const [isTyping, setIsTyping] = useState(false);
  const [typingPersona, setTypingPersona] = useState<PersonaConfig>(LEAD_APPRAISER_PERSONA);
  const [inputText, setInputText] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [rateLimitBanner, setRateLimitBanner] = useState<string | null>(null);

  // New photo attachment for ongoing chat
  const [attachedCloseUp, setAttachedCloseUp] = useState<ProcessedCollectiblePhoto | null>(null);

  // Saving to cabinet modal / inline state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [myCollections, setMyCollections] = useState<CollectionRecord[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(preselectedColId);
  const [creatingInlineCol, setCreatingInlineCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [isGrail, setIsGrail] = useState(false);
  const [acquiredPriceGbp, setAcquiredPriceGbp] = useState('');
  const [acquiredDate, setAcquiredDate] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [shareFreshFind, setShareFreshFind] = useState(true);
  const [includeValueRangeInFreshFind, setIncludeValueRangeInFreshFind] = useState(true);
  const [savingItem, setSavingItem] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<'chat' | 'card'>('chat');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!firebaseUser?.emailVerified) return;
    let active = true;
    listOwnerCollections(firebaseUser.uid, firebaseUser.uid, 50).then((cols) => {
      if (!active) return;
      setMyCollections(cols);
      if (preselectedColId && cols.some((c) => c.id === preselectedColId)) {
        setSelectedCollectionId(preselectedColId);
      } else if (cols.length > 0) {
        setSelectedCollectionId(cols[0].id);
      } else {
        setCreatingInlineCol(true);
        setNewColTitle('My First Collection');
      }
    });
    return () => {
      active = false;
    };
  }, [firebaseUser?.uid, firebaseUser?.emailVerified, preselectedColId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    label: string,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProcessingPhoto(true);
    setPhotoError(null);
    try {
      const processed = await processCollectiblePhoto(file, {
        rotationDeg: 0,
        label,
      });
      setSlots((prev) => [
        ...prev.slice(0, 3),
        {
          id: makeSafeId('slot'),
          file,
          label,
          rotationDeg: 0,
          processed,
        },
      ]);
    } catch (err) {
      console.error('Photo read error:', err);
      setPhotoError('Could not process that photo. Please choose a standard image (JPEG, PNG, WebP).');
    } finally {
      setProcessingPhoto(false);
    }
  };

  const handleRotateSlot = async (slotId: string) => {
    const target = slots.find((s) => s.id === slotId);
    if (!target) return;
    setProcessingPhoto(true);
    try {
      const nextRot = ((target.rotationDeg + 90) % 360) as 0 | 90 | 180 | 270;
      const processed = await processCollectiblePhoto(target.file, {
        rotationDeg: nextRot,
        label: target.label,
      });
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, rotationDeg: nextRot, processed } : s)),
      );
    } finally {
      setProcessingPhoto(false);
    }
  };

  const handleRemoveSlot = (slotId: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
  };

  const handleStartPanel = async () => {
    if (slots.length === 0) return;
    setPanelStarted(true);
    setIsTyping(true);
    setTypingPersona(LEAD_APPRAISER_PERSONA);
    setChatError(null);
    setRateLimitBanner(null);

    const photosPayload: IdentifyPhotoPayload[] = slots.map((s) => ({
      base64: s.processed.identifyBase64,
      mimeType: s.processed.mimeType,
      label: s.label,
    }));

    try {
      const turnRes = await sendPanelChatTurn({
        itemId: chatItemId,
        userId: firebaseUser?.uid,
        photos: photosPayload,
      });

      const newMsgs: PanelChatMessage[] = [];
      if (turnRes.leadMessage) {
        newMsgs.push({
          id: makeSafeId('msg_lead'),
          role: 'lead',
          text: turnRes.leadMessage.text,
          personaId: 'lead',
          createdAt: new Date().toISOString(),
        });
      }

      newMsgs.push({
        id: makeSafeId('msg_spec'),
        role: 'assistant',
        text: turnRes.specialistMessage.text,
        personaId: turnRes.specialistMessage.personaId,
        createdAt: new Date().toISOString(),
      });

      setMessages(newMsgs);
      setCurrentCard(turnRes.card);
      setRollingSummary(turnRes.summary);
      setActivePersonaId(turnRes.specialistMessage.personaId);

      // Persist to Firestore if user is verified
      if (firebaseUser?.emailVerified) {
        void upsertPanelChatRecord({
          itemId: chatItemId,
          ownerId: firebaseUser.uid,
          personaId: turnRes.specialistMessage.personaId,
          messages: newMsgs,
          summary: turnRes.summary,
          card: turnRes.card,
          confidence: turnRes.confidence,
          status: 'active',
        });
      }
    } catch (err) {
      console.error('Initial panel turn error:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not reach the specialist panel. Please check your network and try again.';
      if (msg.includes('15 expert panel messages')) {
        setRateLimitBanner(msg);
      } else {
        setChatError(msg);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText && !attachedCloseUp) return;

    const userMsgId = makeSafeId('msg_user');
    const userMsg: PanelChatMessage = {
      id: userMsgId,
      role: 'user',
      text: cleanText,
      personaId: 'user',
      imageUrls: attachedCloseUp ? [attachedCloseUp.previewUrl] : undefined,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputText('');
    setChatError(null);

    const attachedPhotoPayload = attachedCloseUp
      ? [
          {
            base64: attachedCloseUp.identifyBase64,
            mimeType: attachedCloseUp.mimeType,
            label: 'Close-up Detail',
          },
        ]
      : undefined;

    setAttachedCloseUp(null);
    setIsTyping(true);
    setTypingPersona(getPersonaById(activePersonaId));

    try {
      const turnRes = await sendPanelChatTurn({
        itemId: chatItemId,
        userId: firebaseUser?.uid,
        userMessage: cleanText || 'Here is the close-up photo you requested.',
        photos: attachedPhotoPayload,
        historySummary: rollingSummary,
        currentCard: currentCard || undefined,
        personaId: activePersonaId,
      });

      const assistantMsg: PanelChatMessage = {
        id: makeSafeId('msg_spec'),
        role: 'assistant',
        text: turnRes.specialistMessage.text,
        personaId: turnRes.specialistMessage.personaId,
        createdAt: new Date().toISOString(),
      };

      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);
      setCurrentCard(turnRes.card);
      setRollingSummary(turnRes.summary);
      setActivePersonaId(turnRes.specialistMessage.personaId);

      if (firebaseUser?.emailVerified) {
        void upsertPanelChatRecord({
          itemId: chatItemId,
          ownerId: firebaseUser.uid,
          personaId: turnRes.specialistMessage.personaId,
          messages: finalMessages,
          summary: turnRes.summary,
          card: turnRes.card,
          confidence: turnRes.confidence,
          status: 'active',
        });
      }
    } catch (err) {
      console.error('Chat turn error:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'The specialist is busy right now. Please retry in a few moments.';
      if (msg.includes('15 expert panel messages')) {
        setRateLimitBanner(msg);
      } else {
        setChatError(msg);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleCloseUpAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const processed = await processCollectiblePhoto(file, {
        rotationDeg: 0,
        label: 'Close-up Detail',
      });
      setAttachedCloseUp(processed);
    } catch (err) {
      console.error('Close-up read error:', err);
    }
  };

  const handleSaveToCabinet = async () => {
    if (!firebaseUser?.emailVerified || !profile || !currentCard) return;
    setSavingItem(true);
    setSaveError(null);

    try {
      let targetCollection = myCollections.find((c) => c.id === selectedCollectionId);
      if (creatingInlineCol || !targetCollection) {
        setSaveStatus('Creating collection…');
        targetCollection = await createCollectionRecord({
          profile,
          title: newColTitle.trim() || `My ${CATEGORIES[currentCard.category]?.shortLabel || 'Collector'} Set`,
          story: '',
          category: currentCard.category,
          visibility: 'public',
        });
      }

      // Upload staged photos
      const uploadedPhotos = [];
      for (let i = 0; i < slots.length; i++) {
        setSaveStatus(`Uploading photo ${i + 1} of ${slots.length}…`);
        const uploaded = await uploadProcessedItemPhoto(
          firebaseUser.uid,
          chatItemId,
          i,
          slots[i].processed,
        );
        uploadedPhotos.push(uploaded);
      }

      // Format card attributes & confidences
      const attrs: Record<string, string | boolean> = {};
      const confidences: Record<string, ConfidenceLevel> = {};
      Object.entries(currentCard.fields || {}).forEach(([k, entry]) => {
        attrs[k] = entry.value;
        confidences[k] = entry.confidence;
      });

      const confirmed = isPanelConfirmed(
        currentCard.category,
        currentCard.fields,
        currentCard.overallConfidence,
      );
      const panelStatus: 'none' | 'confirmed' | 'disputed' = confirmed ? 'confirmed' : 'none';
      const panelConfirmedAt = confirmed
        ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())
        : undefined;

      setSaveStatus('Saving piece to your showcase…');
      const created = await addCollectibleItemRecord({
        customItemId: chatItemId,
        collectionRecord: targetCollection,
        profile,
        title: currentCard.title,
        story: rollingSummary || 'Appraised by the Fanzeum AI Expert Panel.',
        category: currentCard.category,
        photos: uploadedPhotos,
        attributes: attrs,
        fieldConfidences: confidences,
        valueMinGbp: currentCard.valueMinGbp,
        valueMaxGbp: currentCard.valueMaxGbp,
        valuationReason: currentCard.valuationReason,
        aiConfidence: currentCard.overallConfidence as AIConfidence,
        grail: isGrail,
        tags: [CATEGORIES[currentCard.category]?.shortLabel.toLowerCase() || 'collectible'],
        acquiredDate,
        acquiredPriceGbp: Number(acquiredPriceGbp) || 0,
        privateNotes,
        panelStatus,
        panelConfirmedAt,
      });

      // Write Fresh Find if enabled
      if (shareFreshFind) {
        setSaveStatus('Sharing as a Fresh Find…');
        const valueRangeStr =
          includeValueRangeInFreshFind && (currentCard.valueMinGbp > 0 || currentCard.valueMaxGbp > 0)
            ? formatGbpRange(currentCard.valueMinGbp, currentCard.valueMaxGbp)
            : undefined;

        await createFreshFindRecord({
          itemId: created.id,
          ownerId: firebaseUser.uid,
          ownerHandle: profile.handle,
          category: currentCard.category,
          title: created.title,
          thumbUrl: created.thumbUrl || created.imageUrl,
          valueRange: valueRangeStr,
          panelStatus,
          isDemo: false,
        });
      }

      // Update panel chat record status to 'saved'
      void upsertPanelChatRecord({
        itemId: chatItemId,
        ownerId: firebaseUser.uid,
        personaId: activePersonaId,
        messages,
        summary: rollingSummary,
        card: currentCard,
        confidence: currentCard.overallConfidence,
        status: 'saved',
      });

      // Trigger want alerts for other collectors matching this new find
      void checkAndTriggerWantAlerts(created);

      await refreshProfile();
      navigate(`/i/${created.id}`);
    } catch (err) {
      console.error('Save piece error:', err);
      setSaveError(getFriendlyFirebaseErrorMessage(err));
      setSavingItem(false);
      setSaveStatus('');
    }
  };

  const activePersona = getPersonaById(activePersonaId);
  const catConfig = currentCard ? CATEGORIES[currentCard.category] : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-24 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono text-brass">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Expert Panel · Specialist Review</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink mt-0.5">
            Identify &amp; Appraise
          </h1>
        </div>

        {/* Panel Avatars Showcase */}
        <div className="flex items-center gap-1.5 p-1 rounded-full bg-surface border border-border">
          {ALL_PERSONAS.map((p) => {
            const isActive = p.id === activePersonaId || (p.id === 'lead' && !panelStarted);
            return (
              <div
                key={p.id}
                title={`${p.name} · ${p.specialistTitle}`}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold font-mono transition-transform cursor-pointer ${
                  isActive
                    ? 'ring-2 ring-brass scale-110 shadow-md font-bold text-ink'
                    : 'opacity-60 hover:opacity-100 text-muted'
                }`}
                style={{
                  backgroundColor: `${p.avatarBadgeColor}20`,
                  borderColor: p.avatarBadgeColor,
                }}
              >
                {p.avatarInitials}
              </div>
            );
          })}
        </div>
      </div>

      {/* STAGE 1: PHOTO SETUP BEFORE CHAT */}
      {!panelStarted && (
        <Card raised className="p-6 sm:p-8 space-y-6 max-w-3xl mx-auto">
          <div className="space-y-1.5">
            <h2 className="text-xl font-display font-semibold text-ink">
              1. Add photos of your piece
            </h2>
            <p className="text-sm text-muted">
              Add the front (and back or reverse if available). Arthur Vance will introduce the
              matching specialist persona right away.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="p-3 rounded-xl border border-border bg-bg space-y-2 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-brass">{slot.label}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void handleRotateSlot(slot.id)}
                      className="p-1 text-muted hover:text-ink cursor-pointer"
                      title="Rotate 90°"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(slot.id)}
                      className="p-1 text-muted hover:text-danger cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="aspect-[4/5] rounded-lg overflow-hidden bg-surface flex items-center justify-center p-2">
                  <img
                    src={slot.processed.previewUrl}
                    alt={slot.label}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            ))}

            {slots.length === 0 && (
              <label className="aspect-[4/5] rounded-2xl border-2 border-dashed border-brass/50 bg-surface hover:bg-surface-raised p-6 flex flex-col items-center justify-center text-center gap-3 transition-colors cursor-pointer">
                <div className="w-12 h-12 rounded-2xl bg-brass text-brass-fg flex items-center justify-center">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-base font-display font-semibold text-ink">Front Photo</div>
                  <div className="text-xs text-muted mt-1">Take photo or choose from camera roll</div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleFileSelect(e, 'Front')}
                  className="sr-only"
                />
              </label>
            )}

            {slots.length === 1 && (
              <label className="aspect-[4/5] rounded-2xl border-2 border-dashed border-border hover:border-brass/50 bg-surface p-6 flex flex-col items-center justify-center text-center gap-3 transition-colors cursor-pointer">
                <div className="w-11 h-11 rounded-2xl bg-surface-raised border border-border text-brass flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-base font-display font-semibold text-ink">
                    Back / Reverse (Recommended)
                  </div>
                  <div className="text-xs text-muted mt-1">
                    Helps spot catalogue numbers, mintmarks, or deadwax
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleFileSelect(e, 'Back / Reverse')}
                  className="sr-only"
                />
              </label>
            )}
          </div>

          {photoError && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
              {photoError}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button
              size="lg"
              disabled={slots.length === 0 || processingPhoto}
              onClick={handleStartPanel}
            >
              <Sparkles className="w-4 h-4" />
              <span>Convene the Expert Panel</span>
            </Button>
          </div>
        </Card>
      )}

      {/* STAGE 2: LIVE EXPERT PANEL CHAT & REAL-TIME STRUCTURED CARD */}
      {panelStarted && (
        <div className="space-y-4">
          {/* Mobile view toggle */}
          <div className="lg:hidden flex items-center gap-2 p-1 rounded-xl bg-surface border border-border">
            <button
              type="button"
              onClick={() => setMobileTab('chat')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                mobileTab === 'chat'
                  ? 'bg-brass text-brass-fg font-semibold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Expert Chat ({messages.length})
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('card')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                mobileTab === 'card'
                  ? 'bg-brass text-brass-fg font-semibold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Piece Card {currentCard ? `(£${currentCard.valueMinGbp}–£${currentCard.valueMaxGbp})` : ''}
            </button>
          </div>

          {rateLimitBanner && (
            <Card className="p-4 border-warn/50 bg-warn/10 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warn shrink-0 mt-0.5" />
              <div className="text-sm text-ink">
                <p className="font-medium">Daily AI Expert Question Limit</p>
                <p className="text-muted mt-0.5">{rateLimitBanner}</p>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* CHAT PANE (Desktop 7 cols, Mobile based on tab) */}
            <div
              className={`lg:col-span-7 space-y-4 lg:sticky lg:top-6 ${
                mobileTab === 'chat' ? 'block' : 'hidden lg:block'
              }`}
            >
              <Card raised className="p-4 sm:p-6 flex flex-col h-[650px] lg:h-[calc(100vh-8rem)]">
                {/* Active Specialist Header */}
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-sm border"
                      style={{
                        backgroundColor: `${activePersona.avatarBadgeColor}25`,
                        borderColor: activePersona.avatarBadgeColor,
                        color: activePersona.avatarBadgeColor,
                      }}
                    >
                      {activePersona.avatarInitials}
                    </div>
                    <div>
                      <div className="font-display font-semibold text-ink text-base">
                        {activePersona.name}
                      </div>
                      <div className="text-xs text-muted">
                        {activePersona.specialistTitle} · {activePersona.oneLineBio}
                      </div>
                    </div>
                  </div>
                  {currentCard && (
                    <ConfidenceChip confidence={currentCard.overallConfidence} compact />
                  )}
                </div>

                {/* Messages Log */}
                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                  {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    const isLead = msg.role === 'lead';
                    const senderPersona = isLead
                      ? LEAD_APPRAISER_PERSONA
                      : isUser
                        ? null
                        : getPersonaById(msg.personaId);

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isUser && (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 border mt-1"
                            style={{
                              backgroundColor: `${senderPersona?.avatarBadgeColor || '#d4af37'}20`,
                              borderColor: senderPersona?.avatarBadgeColor || '#d4af37',
                              color: senderPersona?.avatarBadgeColor || '#d4af37',
                            }}
                          >
                            {senderPersona?.avatarInitials || 'AI'}
                          </div>
                        )}

                        <div
                          className={`max-w-[85%] rounded-2xl p-4 space-y-2 text-sm leading-relaxed ${
                            isUser
                              ? 'bg-brass text-brass-fg rounded-tr-none'
                              : isLead
                                ? 'bg-surface-raised border border-brass/40 text-ink rounded-tl-none'
                                : 'bg-surface border border-border text-ink rounded-tl-none'
                          }`}
                        >
                          {!isUser && (
                            <div className="text-xs font-semibold font-mono text-brass flex items-center justify-between">
                              <span>
                                {senderPersona?.name} ({senderPersona?.specialistTitle})
                              </span>
                            </div>
                          )}

                          {msg.imageUrls && msg.imageUrls.length > 0 && (
                            <div className="flex gap-2 py-1">
                              {msg.imageUrls.map((url, i) => (
                                <img
                                  key={i}
                                  src={url}
                                  alt="Close-up attachment"
                                  className="w-20 h-20 rounded-lg object-contain bg-bg border border-border"
                                />
                              ))}
                            </div>
                          )}

                          <div className="whitespace-pre-wrap">{msg.text}</div>

                          {!isUser && (
                            <div className="text-[11px] text-muted/80 pt-1 border-t border-border/40 flex items-center gap-1">
                              <Info className="w-3 h-3 text-brass shrink-0" />
                              <span>AI estimate, not a professional valuation or authentication.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Typing Indicator */}
                  {isTyping && (
                    <div className="flex gap-3 justify-start items-center">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 border"
                        style={{
                          backgroundColor: `${typingPersona.avatarBadgeColor}20`,
                          borderColor: typingPersona.avatarBadgeColor,
                          color: typingPersona.avatarBadgeColor,
                        }}
                      >
                        {typingPersona.avatarInitials}
                      </div>
                      <div className="p-3 rounded-2xl bg-surface border border-border text-xs text-muted flex items-center gap-2">
                        <span className="font-medium text-ink">{typingPersona.name}</span>
                        <span>is examining details…</span>
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-brass animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-brass animate-bounce [animation-delay:0.2s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-brass animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {chatError && (
                  <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg p-2.5 mb-2">
                    {chatError}
                  </p>
                )}

                {/* Input Bar */}
                <form
                  onSubmit={handleSendMessage}
                  className="pt-3 border-t border-border space-y-2"
                >
                  {attachedCloseUp && (
                    <div className="flex items-center gap-2 p-1.5 rounded-lg bg-bg border border-border text-xs">
                      <img
                        src={attachedCloseUp.previewUrl}
                        alt="Attached close-up"
                        className="w-10 h-10 object-contain rounded"
                      />
                      <span className="text-muted flex-1 truncate">Close-up attached</span>
                      <button
                        type="button"
                        onClick={() => setAttachedCloseUp(null)}
                        className="p-1 text-muted hover:text-danger cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <label
                      title="Attach close-up photo"
                      className="p-2.5 rounded-xl border border-border bg-surface text-muted hover:text-ink hover:border-brass/50 transition-colors cursor-pointer shrink-0"
                    >
                      <Camera className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCloseUpAttach}
                        className="sr-only"
                      />
                    </label>

                    <input
                      type="text"
                      maxLength={1000}
                      disabled={isTyping}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={`Ask ${activePersona.firstName} a question or provide requested details…`}
                      className="flex-1 min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink placeholder:text-muted/60"
                    />

                    <Button
                      type="submit"
                      disabled={isTyping || (!inputText.trim() && !attachedCloseUp)}
                      size="sm"
                      className="shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </form>
              </Card>
            </div>

            {/* LIVE STRUCTURED CARD PANE (Desktop 5 cols, Mobile based on tab) */}
            <div
              className={`lg:col-span-5 space-y-4 ${
                mobileTab === 'card' ? 'block' : 'hidden lg:block'
              }`}
            >
              {currentCard ? (
                <Card raised className="p-6 space-y-6">
                  {/* Top card banner */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                    <div className="inline-flex items-center gap-2">
                      <CategoryIcon category={currentCard.category} className="w-4 h-4 text-brass" />
                      <span className="text-xs font-mono font-medium text-brass uppercase tracking-wider">
                        {catConfig?.shortLabel}
                      </span>
                    </div>
                    <ConfidenceChip confidence={currentCard.overallConfidence} />
                  </div>

                  {/* Primary Photo & Title */}
                  <div className="space-y-3">
                    {slots[0] && (
                      <div className="aspect-[4/5] rounded-xl bg-bg border border-border p-3 flex items-center justify-center">
                        <img
                          src={slots[0].processed.previewUrl}
                          alt={currentCard.title}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl sm:text-2xl font-display font-semibold text-ink">
                        {currentCard.title}
                      </h3>
                      <p className="text-xs font-mono text-muted mt-1">
                        Condition: <span className="text-ink font-medium">{currentCard.conditionGuess}</span>
                      </p>
                    </div>
                  </div>

                  {/* Valuation Range Box */}
                  <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                    <div className="text-xs font-mono text-muted">Estimated UK Market Range</div>
                    <div className="text-2xl font-mono font-semibold text-brass tabular-nums">
                      {formatGbpRange(currentCard.valueMinGbp, currentCard.valueMaxGbp)}
                    </div>
                    {currentCard.valuationReason && (
                      <p className="text-xs text-muted leading-relaxed">
                        {currentCard.valuationReason}
                      </p>
                    )}
                    <div className="text-[11px] text-muted flex items-center gap-1 pt-1">
                      <Info className="w-3 h-3 text-brass shrink-0" />
                      <span>AI estimate, not a professional valuation or authentication.</span>
                    </div>
                  </div>

                  {/* Category Diagnostic Fields */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-muted">
                      {catConfig?.shortLabel} Specifications
                    </h4>
                    <div className="grid grid-cols-1 gap-2.5">
                      {catConfig?.fields.map((f) => {
                        const entry = currentCard.fields[f.key];
                        const val = entry?.value;
                        const isLow = entry?.confidence === 'low';

                        return (
                          <div
                            key={f.key}
                            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                              isLow ? 'border-warn/50 bg-warn/5' : 'border-border bg-bg'
                            }`}
                          >
                            <span className="text-muted">{f.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-ink font-mono text-right truncate max-w-[160px]">
                                {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : val || '—'}
                              </span>
                              {entry?.confidence && (
                                <ConfidenceChip confidence={entry.confidence} compact />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Save to Cabinet CTA */}
                  <div className="pt-2">
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => setShowSaveModal(true)}
                    >
                      <Check className="w-4 h-4" />
                      <span>Save piece to Showcase</span>
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card raised className="p-8 text-center space-y-3">
                  <Sparkles className="w-8 h-8 text-brass mx-auto animate-pulse" />
                  <p className="text-sm text-muted">Building card from specialist consultation…</p>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SAVE TO CABINET MODAL */}
      {showSaveModal && currentCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card raised className="max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xl font-display font-semibold text-ink">Save to Showcase</h3>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="text-muted hover:text-ink text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-muted mb-1">Piece Title</label>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={currentCard.title}
                  onChange={(e) =>
                    setCurrentCard((c) => (c ? { ...c, title: e.target.value } : c))
                  }
                  className="w-full min-h-[42px] px-3 text-sm rounded-xl border border-border bg-bg text-ink"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted">Collection</label>
                  {myCollections.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCreatingInlineCol((v) => !v)}
                      className="text-xs text-brass hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <FolderPlus className="w-3 h-3" />
                      <span>{creatingInlineCol ? 'Pick existing' : 'New collection'}</span>
                    </button>
                  )}
                </div>

                {creatingInlineCol || myCollections.length === 0 ? (
                  <input
                    type="text"
                    required
                    value={newColTitle}
                    onChange={(e) => setNewColTitle(e.target.value)}
                    placeholder={`e.g. My ${catConfig?.shortLabel || 'Collector'} Set`}
                    className="w-full min-h-[42px] px-3 text-sm rounded-xl border border-border bg-bg text-ink"
                  />
                ) : (
                  <select
                    value={selectedCollectionId}
                    onChange={(e) => setSelectedCollectionId(e.target.value)}
                    className="w-full min-h-[42px] px-3 text-sm rounded-xl border border-border bg-bg text-ink"
                  >
                    {myCollections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.itemCount} pieces)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Private Notes & Acquisition */}
              <div className="p-3 rounded-xl bg-surface border border-border space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-brass">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Private Acquisition Notes (Optional)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-muted mb-0.5">Price Paid (£)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={acquiredPriceGbp}
                      onChange={(e) => setAcquiredPriceGbp(e.target.value)}
                      placeholder="0.00"
                      className="w-full min-h-[38px] px-2.5 text-xs font-mono rounded-lg border border-border bg-bg text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted mb-0.5">Date Acquired</label>
                    <input
                      type="text"
                      value={acquiredDate}
                      onChange={(e) => setAcquiredDate(e.target.value)}
                      placeholder="e.g. Nov 2024"
                      className="w-full min-h-[38px] px-2.5 text-xs rounded-lg border border-border bg-bg text-ink"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-muted mb-0.5">Private Note</label>
                  <input
                    type="text"
                    value={privateNotes}
                    onChange={(e) => setPrivateNotes(e.target.value)}
                    placeholder="Purchased at fair, cert #, provenance…"
                    className="w-full min-h-[38px] px-2.5 text-xs rounded-lg border border-border bg-bg text-ink"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-ink cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isGrail}
                  onChange={(e) => setIsGrail(e.target.checked)}
                  className="w-4 h-4 accent-brass"
                />
                <span>Mark as a Grail Piece</span>
              </label>

              {/* Share as a Fresh Find */}
              <div className="p-3 rounded-xl bg-surface border border-brass/30 space-y-2">
                <label className="flex items-start gap-2.5 text-xs text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareFreshFind}
                    onChange={(e) => setShareFreshFind(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-brass"
                  />
                  <div>
                    <span className="font-semibold text-brass">Share as a Fresh Find</span>
                    <p className="text-[11px] text-muted mt-0.5">
                      Showcase this piece in the public Fresh Finds feed. Zero location data or private price paid are ever shown.
                    </p>
                  </div>
                </label>

                {shareFreshFind && (
                  <div className="pl-6 pt-1 border-t border-border/50">
                    <label className="flex items-center gap-2 text-[11px] text-muted hover:text-ink cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeValueRangeInFreshFind}
                        onChange={(e) => setIncludeValueRangeInFreshFind(e.target.checked)}
                        className="w-3.5 h-3.5 accent-brass"
                      />
                      <span>Show estimated guide ({formatGbpRange(currentCard.valueMinGbp, currentCard.valueMaxGbp)}) on Fresh Find card</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg p-2.5">
                {saveError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                disabled={savingItem}
                onClick={() => setShowSaveModal(false)}
              >
                Back to chat
              </Button>

              {!firebaseUser ? (
                <Button onClick={openAuthModal}>
                  <span>Sign in to save</span>
                </Button>
              ) : !firebaseUser.emailVerified ? (
                <Button disabled>
                  <span>Verify email to save</span>
                </Button>
              ) : (
                <Button disabled={savingItem} onClick={handleSaveToCabinet}>
                  <Check className="w-4 h-4" />
                  <span>{savingItem ? saveStatus || 'Saving…' : 'Confirm & Save'}</span>
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
