import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';

export const CheckoutSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setMessage('No session ID found. Your payment may not have been completed.');
      return;
    }
    let cancelled = false;
    const verify = async () => {
      try {
        const res = await fetch('/api/checkout/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          setStatus('success');
          setMessage('Your payment has been confirmed. The listing is now marked as sold.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Something went wrong verifying your payment.');
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setMessage('Could not connect to the server. Please check your connection.');
        }
      }
    };
    verify();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (status === 'loading') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-16 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-16">
        <EmptyState
          title="Payment not confirmed"
          description={message}
          action={
            <Link to="/marketplace">
              <Button>Back to Marketplace</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-16">
      <EmptyState
        title="Payment successful"
        description={message}
        action={
          <Link to="/marketplace">
            <Button>Back to Marketplace</Button>
          </Link>
        }
      />
    </div>
  );
};
