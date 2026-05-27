/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';

vi.mock('next/link', () => ({ default: ({ href, children }: any) => React.createElement('a', { href }, children) }));
import HomeClient from '@/app/components/HomeClient';

describe('HomeClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows login links when unauthenticated', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
      if (String(url).includes('/api/auth/me')) return { ok: false } as any;
      return { ok: false } as any;
    }));
    render(React.createElement(HomeClient));
    await waitFor(() => expect(screen.getByText('Login')).toBeInTheDocument());
  });

  it('shows user and handles logout', async () => {
    const fetchMock = vi.fn(async (url: any) => {
      if (String(url).includes('/api/auth/me')) return { ok: true, json: async () => ({ user: { email: 'u@example.com', role: 'user' } }) } as any;
      return { ok: true, json: async () => ({}) } as any;
    });
    vi.stubGlobal('fetch', fetchMock as any);
    render(React.createElement(HomeClient));
    await waitFor(() => expect(screen.getByText('u@example.com')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' })));
  });

  it('uses refresh flow and renders admin action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: any) => {
        const u = String(url);
        if (u.includes('/api/auth/me')) return { ok: false } as any;
        if (u.includes('/api/auth/refresh')) {
          return {
            ok: true,
            json: async () => ({ accessToken: 'token-1', user: { email: 'admin@example.com', role: 'admin' } })
          } as any;
        }
        return { ok: true, json: async () => ({}) } as any;
      }) as any
    );

    render(React.createElement(HomeClient));
    await waitFor(() => expect(screen.getByText('admin@example.com')).toBeInTheDocument());
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
  });
});
