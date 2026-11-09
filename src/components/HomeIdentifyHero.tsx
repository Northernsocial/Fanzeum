import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Camera,
  ChevronDown,
  Image as ImageIcon,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { formatGbpRange } from '../lib/entitlements';

interface ExampleResult {
  title: string;
  category: string;
  whatYouveGot: string;
  valueMinGbp: number;
  valueMaxGbp: number;
  valuationReason: string;
  overallConfidence: 'high' | 'medium' | 'low';
  reasons: string[];
}

const EXAMPLE_RESULT: ExampleResult = {
  title: '1970 Mexico World Cup Panini Album – Complete',
  category: 'football_cards',
  whatYouveGot:
    'A complete 1970 Mexico World Cup Panini sticker album with all 271 stickers mounted. The album shows honest wear to corners and spine, typical for a 50-year-old piece handled by a young collector. All stickers are present including the rare Brazil team badge and Pelé portrait.',
  valueMinGbp: 320,
  valueMaxGbp: 480,
  valuationReason: 'Complete albums in this condition sold £300–£500 on UK eBay in the last 6 months; missing stickers drop value sharply.',
  overallConfidence: 'high',
  reasons: [
    'All 271 stickers verified present including high-value Brazil badge and Pelé',
    'Album cover and pages intact with only minor corner wear and spine creasing',
    'Recent UK sold comparables for complete 1970 albums cluster £320–£480',
  ],
};

export const HomeIdentifyHero: React.FC = () => {
  const { firebaseUser, profile, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
    e.target.value = '';
  }, []);

  const handleIdentifyClick = () => {
    if (!firebaseUser) {
      openAuthModal();
      return;
    }
    if (!firebaseUser.emailVerified) {
      openAuthModal();
      return;
    }
    if (!selectedFile) return;

    // Store file reference in sessionStorage for the AddPiecePage to pick up
    // We'll use a short-lived approach: upload to a temp path and pass the reference
    // For now, store base64 in sessionStorage (will be replaced with signed URL approach)
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      sessionStorage.setItem('fanzeum_identify_photo', base64);
      sessionStorage.setItem('fanzeum_identify_filename', selectedFile.name);
      sessionStorage.setItem('fanzeum_identify_mimetype', selectedFile.type);
      navigate('/add');
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleExampleClick = () => {
    setShowExample(!showExample);
  };

  const handleRemovePhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  return (
    <section className="relative border-b border-border bg-surface/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-14 lg:py-20 space-y-8">
        {/* Hero Content */}
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brass/10 border border-brass/30 text-brass text-sm font-mono">
            <Sparkles className="w-4 h-4" />
            <span>Instant AI identification &amp; UK £ valuation</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-semibold text-ink leading-[1.08] tracking-tight">
            What&apos;s it worth? Snap a photo and find out in seconds.
          </h1>

          <p className="text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            Front and back. Cards, coins, stamps, comics, vinyl, toys. We spot the set, catalogue number,
            condition and realistic UK market price range—then display it in your showcase.
          </p>

          {/* Upload Zone */}
          <div className="mt-4">
            {selectedFile && previewUrl ? (
              <div className="max-w-md mx-auto space-y-4">
                <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-bg border border-border">
                  <img
                    src={previewUrl}
                    alt="Selected photo preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    aria-label="Remove photo"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <Button
                  size="lg"
                  className="w-full max-w-xs mx-auto"
                  onClick={handleIdentifyClick}
                  disabled={!firebaseUser || !firebaseUser.emailVerified}
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Identify &amp; Value It</span>
                </Button>
                {!firebaseUser && (
                  <p className="text-xs text-muted text-center">
                    Sign in or create a free account to use the AI panel.
                  </p>
                )}
                {firebaseUser && !firebaseUser.emailVerified && (
                  <p className="text-xs text-warn text-center">
                    Verify your email to unlock identification.
                  </p>
                )}
              </div>
            ) : (
              <div
                className={`max-w-md mx-auto rounded-2xl border-2 p-8 transition-colors cursor-pointer ${
                  dragActive
                    ? 'border-brass bg-brass/5'
                    : 'border-border hover:border-brass/50 bg-surface/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="sr-only"
                  id="hero-photo-upload"
                />
                <label htmlFor="hero-photo-upload" className="cursor-pointer block">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-brass/10 border border-brass/30 flex items-center justify-center">
                      <Camera className="w-7 h-7 text-brass" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-medium text-ink">Tap to upload or drag a photo</p>
                      <p className="text-xs text-muted mt-1">Front of the piece (add back on next screen)</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span>JPEG, PNG, WebP</span>
                      <span aria-hidden="true">·</span>
                      <span>Up to 10 MB</span>
                    </div>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Example Result Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExampleClick}
            className="text-brass hover:text-brass/80"
          >
            <span className="flex items-center gap-1.5">
              {showExample ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ArrowUpRight className="w-4 h-4" />
              )}
              <span>
                {showExample ? 'Hide example result' : 'See an example result'}
              </span>
            </span>
          </Button>

          {/* Example Result Card */}
          {showExample && (
            <ExampleResultCard result={EXAMPLE_RESULT} />
          )}

          {/* Plan Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border">
              <Sparkles className="w-3.5 h-3.5 text-brass" />
              <span className="text-sm font-medium text-ink">Free: AI identification &amp; £ valuation</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border">
              <Sparkles className="w-3.5 h-3.5 text-muted" />
              <span className="text-sm font-medium text-muted">Premium: Expert alerts &amp; buyer interest <span className="text-brass">(waitlist)</span></span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const ExampleResultCard: React.FC<{ result: ExampleResult }> = ({ result }) => {
  const confidenceColors = {
    high: 'text-emerald border-emerald/30 bg-emerald/10',
    medium: 'text-amber border-amber/30 bg-amber/10',
    low: 'text-warn border-warn/30 bg-warn/10',
  };

  return (
    <Card raised className="max-w-3xl mx-auto p-6 space-y-4 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border text-xs font-mono text-brass">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Example AI Result</span>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-mono ${confidenceColors[result.overallConfidence]}`}>
          {result.overallConfidence} confidence
        </span>
      </div>

      <h3 className="text-xl font-display font-semibold text-ink">{result.title}</h3>

      <p className="text-sm text-muted leading-relaxed">{result.whatYouveGot}</p>

      <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
        <div className="text-xs font-mono text-muted">Estimated UK Market Range</div>
        <div className="text-2xl font-mono font-semibold text-brass tabular-nums">
          {formatGbpRange(result.valueMinGbp, result.valueMaxGbp)}
        </div>
        <p className="text-xs text-muted leading-relaxed">{result.valuationReason}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-mono text-muted">Why this range:</p>
        <ul className="space-y-1.5">
          {result.reasons.map((reason, i) => (
            <li key={i} className="text-sm text-ink leading-relaxed flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brass mt-2 shrink-0" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-2 text-[11px] text-muted flex items-center gap-1">
        <span className="w-3.5 h-3.5 rounded-full bg-brass/20 flex items-center justify-center">
          <Sparkles className="w-2.5 h-2.5 text-brass" />
        </span>
        <span>AI estimate, not a professional valuation or authentication.</span>
      </div>
    </Card>
  );
};
