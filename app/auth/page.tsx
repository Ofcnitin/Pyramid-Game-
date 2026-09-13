'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { getSupabase } from '@/lib/supabase';

function AuthForm() {
  const router = useRouter();
  const search = useSearchParams();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const confirmed = search.get('checkEmail') === '1';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const supabase = getSupabase();

      if (!supabase) {
        throw new Error(
          'Authentication is unavailable until Supabase is configured.'
        );
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: name || email.split('@')[0],
            },
          },
        });

        if (error) throw error;

        router.push('/auth?checkEmail=1');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-art">
        <div>
          <Logo dark />

          <h1 className="auth-title">
            See Beyond
            <br />
            the <span>Surface.</span>
          </h1>

          <p className="auth-copy">
            Every vote reveals a perspective. Every rank changes the game.
          </p>

          <div className="eyebrow" style={{ marginTop: 50 }}>
            RANKS REVEAL PEOPLE.
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <div className="eyebrow">PYRAMID GAME</div>

          <h1 className="page-title">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h1>

          <p className="sub">
            {mode === 'signin'
              ? 'Enter the game.'
              : 'Your account is required to play.'}
          </p>

          {mode === 'signup' && (
            <div className="field">
              <label>Display name</label>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nick"
                maxLength={30}
                required
              />
            </div>
          )}

          <div className="field">
            <label>Email</label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label>Password</label>

            <div style={{ position: 'relative' }}>
              <input
                style={{
                  width: '100%',
                  paddingRight: 45,
                }}
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
                autoComplete={
                  mode === 'signin'
                    ? 'current-password'
                    : 'new-password'
                }
              />

              <button
                type="button"
                className="icon-btn"
                style={{
                  position: 'absolute',
                  right: 5,
                  top: 5,
                  border: 0,
                }}
                onClick={() => setShow(!show)}
                aria-label="Toggle password visibility"
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {confirmed && (
            <div className="success">
              Account created. If email confirmation is enabled, verify your
              email before signing in.
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <button
            className="btn red"
            style={{
              width: '100%',
              marginTop: 12,
            }}
            disabled={busy}
          >
            {busy
              ? 'Please wait…'
              : mode === 'signin'
                ? 'Sign In'
                : 'Create Account'}

            <ArrowRight size={15} />
          </button>

          <p
            className="small"
            style={{
              marginTop: 18,
              textAlign: 'center',
            }}
          >
            {mode === 'signin' ? (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  style={{
                    border: 0,
                    background: 'none',
                    color: 'var(--red)',
                    fontWeight: 600,
                  }}
                >
                  Sign Up
                </button>
              </>
            ) : (
              <>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  style={{
                    border: 0,
                    background: 'none',
                    color: 'var(--red)',
                    fontWeight: 600,
                  }}
                >
                  Sign In
                </button>
              </>
            )}
          </p>
        </form>
      </section>
    </div>
  );
}

export default function Auth() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
              }
