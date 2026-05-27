/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

import UserWorkspace from '@/app/components/users/UserWorkspace';

describe('UserWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
      if (String(url).includes('/api/docs')) return { ok: true, json: async () => ({ docs: [] }) } as any;
      return { ok: true, json: async () => ({}) } as any;
    }) as any);
  });

  it('renders workspace shell and preview', async () => {
    render(React.createElement(UserWorkspace));
    await waitFor(() => expect(screen.getByText('User Workspace')).toBeInTheDocument());
    expect(screen.getByText('Markdown Preview')).toBeInTheDocument();
  });

  it('toggles preview mode', async () => {
    render(React.createElement(UserWorkspace));
    await waitFor(() => expect(screen.getByText('Rendered Preview')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Rendered Preview' }));
    expect(screen.getByRole('button', { name: 'Code Preview' })).toBeInTheDocument();
  });
});
