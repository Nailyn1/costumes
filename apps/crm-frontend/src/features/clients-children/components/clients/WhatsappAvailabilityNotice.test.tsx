import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { API_URL, server } from '../../../../../test/server';
import { renderWithProviders } from '../../../../../test/render';
import { WhatsappAvailabilityNotice } from './WhatsappAvailabilityNotice';

describe('WhatsappAvailabilityNotice', () => {
  it('checks the selected number and allows retry after an absent result', async () => {
    const requests = vi.fn(({ request }: { request: Request }) =>
      HttpResponse.json({
        status: new URL(request.url).searchParams.get('force') === 'true' ? 'exists' : 'absent',
      }),
    );
    server.use(http.get(`${API_URL}/clients/:clientId/whatsapp-availability`, requests));
    const user = userEvent.setup();
    renderWithProviders(<WhatsappAvailabilityNotice clientId={7} phone="+77071234567" />);
    expect(await screen.findByText(/WhatsApp не найден/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Проверить повторно' }));
    expect(await screen.findByText('WhatsApp есть')).toBeInTheDocument();
    expect(requests).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Проверить повторно' })).not.toBeInTheDocument();
  });

  it('shows confirmed WhatsApp immediately without requesting availability', () => {
    const requests = vi.fn(() => HttpResponse.json({ status: 'absent' }));
    server.use(http.get(`${API_URL}/clients/:clientId/whatsapp-availability`, requests));
    renderWithProviders(<WhatsappAvailabilityNotice clientId={7} phone="+77071234567" whatsappConfirmed />);
    expect(screen.getByText('WhatsApp есть')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Проверить повторно' })).not.toBeInTheDocument();
    expect(requests).not.toHaveBeenCalled();
  });

  it('checks a new phone after previously confirmed proof is invalidated', async () => {
    const requests = vi.fn(() => HttpResponse.json({ status: 'absent' }));
    server.use(http.get(`${API_URL}/clients/:clientId/whatsapp-availability`, requests));
    const view = renderWithProviders(<WhatsappAvailabilityNotice clientId={7} phone="+77071234567" whatsappConfirmed />);
    expect(screen.getByText('WhatsApp есть')).toBeInTheDocument();
    view.rerender(<WhatsappAvailabilityNotice clientId={7} phone="+77071234568" whatsappConfirmed={false} />);
    expect(await screen.findByText(/WhatsApp не найден/)).toBeInTheDocument();
    expect(requests).toHaveBeenCalledTimes(1);
  });

  it('does not reuse the old result after a phone change', async () => {
    const requests = vi.fn()
      .mockImplementationOnce(() => HttpResponse.json({ status: 'exists' }))
      .mockImplementationOnce(() => HttpResponse.json({ status: 'absent' }));
    server.use(http.get(`${API_URL}/clients/:clientId/whatsapp-availability`, requests));
    const view = renderWithProviders(<WhatsappAvailabilityNotice clientId={7} phone="+77071234567" />);
    expect(await screen.findByText('WhatsApp есть')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Проверить повторно' })).not.toBeInTheDocument();
    view.rerender(<WhatsappAvailabilityNotice clientId={7} phone="+77071234568" />);
    expect(await screen.findByText(/WhatsApp не найден/)).toBeInTheDocument();
    expect(requests).toHaveBeenCalledTimes(2);
  });
});
