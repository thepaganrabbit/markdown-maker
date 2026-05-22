'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

type Props = {
  mode: 'login' | 'signup';
};

export default function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? 'Authentication failed');
        return;
      }

      localStorage.setItem('accessToken', json.accessToken);
      localStorage.setItem('userEmail', json.user.email);
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next || '/users');
      router.refresh();
    } catch {
      setError('Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card auth-card shadow-sm">
      <div className="card-body p-4 p-md-5">
        <h1 className="h3 mb-4 text-center">{mode === 'login' ? 'Login' : 'Sign up'}</h1>
        <form onSubmit={onSubmit} className="d-grid gap-3">
          <div>
            <label className="form-label">Email</label>
            <input
              className="form-control"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Password</label>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error ? <div className="alert alert-danger py-2 mb-0">{error}</div> : null}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>

        <p className="text-center mt-3 mb-0">
          {mode === 'login' ? (
            <>
              No account? <Link href="/signup">Sign up</Link>
            </>
          ) : (
            <>
              Already have an account? <Link href="/login">Login</Link>
            </>
          )}
        </p>
        <div className="text-center mt-3">
          <a className="btn btn-outline-secondary btn-sm" href="/api/auth/oauth2/login">
            Continue with OAuth2
          </a>
        </div>
      </div>
    </div>
  );
}
