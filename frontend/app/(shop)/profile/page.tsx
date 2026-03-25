'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import {
  authenticateWithPasskey,
  getAuthAssuranceLevel,
  isPasskeySupported,
  listPasskeys,
  registerPasskey,
  removePasskey,
  type AuthAssuranceLevel,
  type PasskeyFactor,
} from '@/lib/authClient';
import { useStore } from '@/store/StoreContext';

const formatTimestamp = (value: string | null): string => {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleString();
};

export default function ProfilePage() {
  const { auth, logout } = useStore();
  const [passkeys, setPasskeys] = useState<PasskeyFactor[]>([]);
  const [passkeyName, setPasskeyName] = useState('');
  const [loadingPasskeys, setLoadingPasskeys] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);
  const [assurance, setAssurance] = useState<AuthAssuranceLevel>({
    currentLevel: null,
    nextLevel: null,
  });

  const passkeySupported = isPasskeySupported();
  const canManagePasskeys = auth.isAuthenticated && passkeySupported;

  const refreshPasskeys = async () => {
    if (!canManagePasskeys) {
      setPasskeys([]);
      setAssurance({ currentLevel: null, nextLevel: null });
      return;
    }

    setLoadingPasskeys(true);
    setPasskeyError(null);

    try {
      const [factors, assuranceLevel] = await Promise.all([listPasskeys(), getAuthAssuranceLevel()]);
      setPasskeys(factors);
      setAssurance(assuranceLevel);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load passkeys';
      setPasskeyError(message);
    } finally {
      setLoadingPasskeys(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleRegisterPasskey = async () => {
    if (!canManagePasskeys) {
      return;
    }

    setActionLoading(true);
    setPasskeyError(null);
    setPasskeyMessage(null);

    try {
      await registerPasskey(passkeyName);
      setPasskeyMessage('Passkey registered successfully.');
      setPasskeyName('');
      await refreshPasskeys();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to register passkey';
      setPasskeyError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyPasskey = async (factorId: string) => {
    setActionLoading(true);
    setPasskeyError(null);
    setPasskeyMessage(null);

    try {
      await authenticateWithPasskey(factorId);
      setPasskeyMessage('Passkey verification successful.');
      await refreshPasskeys();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to verify passkey';
      setPasskeyError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemovePasskey = async (factorId: string) => {
    setActionLoading(true);
    setPasskeyError(null);
    setPasskeyMessage(null);

    try {
      await removePasskey(factorId);
      setPasskeyMessage('Passkey removed.');
      await refreshPasskeys();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove passkey';
      setPasskeyError(message);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (!canManagePasskeys) {
      setPasskeys([]);
      setAssurance({ currentLevel: null, nextLevel: null });
      return;
    }

    let cancelled = false;

    const hydratePasskeys = async () => {
      setLoadingPasskeys(true);
      setPasskeyError(null);

      try {
        const [factors, assuranceLevel] = await Promise.all([listPasskeys(), getAuthAssuranceLevel()]);
        if (cancelled) {
          return;
        }
        setPasskeys(factors);
        setAssurance(assuranceLevel);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unable to load passkeys';
        setPasskeyError(message);
      } finally {
        if (!cancelled) {
          setLoadingPasskeys(false);
        }
      }
    };

    void hydratePasskeys();

    return () => {
      cancelled = true;
    };
  }, [canManagePasskeys]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="section-kicker">Account</p>
        <h1 className="section-title">Profile</h1>
      </div>

      <div className="card p-6 space-y-4">
        <p className="text-sm text-muted">Signed in as</p>
        <h2 className="text-xl font-semibold">{auth.user?.name ?? 'Guest'}</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted">Email</p>
            <p className="font-semibold">{auth.user?.email ?? 'Not provided'}</p>
          </div>
          <div>
            <p className="text-muted">Phone</p>
            <p className="font-semibold">{auth.user?.phone ?? 'Not provided'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Edit profile</Button>
          <Button onClick={() => void handleLogout()}>Sign out</Button>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Security</p>
            <h2 className="text-xl font-semibold">Passkeys</h2>
            <p className="text-sm text-muted mt-1">
              Manage WebAuthn passkeys for stronger account protection and step-up verification.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void refreshPasskeys()}
            disabled={loadingPasskeys || actionLoading || !canManagePasskeys}
          >
            Refresh
          </Button>
        </div>

        {!auth.isAuthenticated ? (
          <p className="text-sm text-muted">Sign in to manage passkeys.</p>
        ) : !passkeySupported ? (
          <p className="text-sm text-muted">
            This browser does not support passkeys. Use a modern WebAuthn-enabled browser.
          </p>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted">Current assurance level</p>
                <p className="font-semibold">{assurance.currentLevel ?? 'aal1'}</p>
              </div>
              <div>
                <p className="text-muted">Next assurance target</p>
                <p className="font-semibold">{assurance.nextLevel ?? 'aal2'}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-[1fr_auto] gap-3">
              <input
                className="input-field"
                placeholder="Passkey label (optional)"
                value={passkeyName}
                onChange={(event) => setPasskeyName(event.target.value)}
                maxLength={80}
              />
              <Button onClick={() => void handleRegisterPasskey()} disabled={actionLoading || loadingPasskeys}>
                Add passkey
              </Button>
            </div>

            {passkeyError ? <p className="text-sm text-rose-700">{passkeyError}</p> : null}
            {passkeyMessage ? <p className="text-sm text-emerald-700">{passkeyMessage}</p> : null}

            <div className="space-y-3">
              {loadingPasskeys ? <p className="text-sm text-muted">Loading passkeys...</p> : null}
              {!loadingPasskeys && passkeys.length === 0 ? (
                <p className="text-sm text-muted">No passkeys enrolled yet.</p>
              ) : null}

              {!loadingPasskeys &&
                passkeys.map((factor) => (
                  <div key={factor.id} className="border border-line/60 rounded-xl p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{factor.friendlyName}</p>
                      <p className="text-xs text-muted">
                        Status: {factor.status} | Created: {formatTimestamp(factor.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleVerifyPasskey(factor.id)}
                        disabled={actionLoading}
                      >
                        Verify
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleRemovePasskey(factor.id)}
                        disabled={actionLoading}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
