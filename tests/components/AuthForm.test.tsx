/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('next/link', () => ({ default: ({ href, children }: any) => React.createElement('a', { href }, children) }));

import AuthForm from '@/app/components/AuthForm';

describe('AuthForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ accessToken: 'a', user: { email: 'u@example.com' } }) })) as any);
  });

  it('renders login mode and submits', async () => {
    const { container } = render(React.createElement(AuthForm, { mode: 'login' }));
    const emailInput = screen.getByRole('textbox') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'u@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it('renders signup mode', () => {
    render(React.createElement(AuthForm, { mode: 'signup' }));
    expect(screen.getByText('Sign up')).toBeInTheDocument();
  });

  it('shows api error message when auth fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'Invalid credentials' }) })) as any);
    const { container } = render(React.createElement(AuthForm, { mode: 'login' }));
    const emailInput = screen.getByRole('textbox') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'u@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'badpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument());
  });
});
