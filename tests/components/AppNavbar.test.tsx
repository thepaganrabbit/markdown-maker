/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => React.createElement('a', { href, ...rest }, children) }));
import AppNavbar from '@/app/components/nav/AppNavbar';

describe('AppNavbar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders guest actions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })) as any);
    render(React.createElement(AppNavbar));
    await waitFor(() => expect(screen.getByText('Login')).toBeInTheDocument());
  });

  it('renders user menu', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ user: { email: 'admin@example.com', role: 'admin' } }) })) as any);
    render(React.createElement(AppNavbar));
    await waitFor(() => expect(screen.getByText('admin@example.com')).toBeInTheDocument());
    fireEvent.click(screen.getByText('admin@example.com'));
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('logs out with csrf header when token cookie exists', async () => {
    const fetchMock = vi.fn(async (url: any) => {
      if (String(url).includes('/api/auth/me')) {
        return { ok: true, json: async () => ({ user: { email: 'user@example.com', role: 'user' } }) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });
    vi.stubGlobal('fetch', fetchMock as any);
    document.cookie = 'csrfToken=abc123';

    render(React.createElement(AppNavbar));
    await waitFor(() => expect(screen.getByText('user@example.com')).toBeInTheDocument());
    fireEvent.click(screen.getByText('user@example.com'));
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Headers)
        })
      )
    );
  });
});
