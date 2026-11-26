import { NotificationProcessor } from '../notification.processor';

describe('NotificationProcessor', () => {
  let service: {
    isInstanceAuthorized: jest.Mock;
    processWhatsAppSending: jest.Mock;
  };
  let processor: NotificationProcessor;

  const job = (name: string) =>
    ({
      id: 'notification-4',
      name,
      data: { notificationId: 4, traceId: 't' },
    }) as never;

  beforeEach(() => {
    service = {
      isInstanceAuthorized: jest.fn().mockResolvedValue(true),
      processWhatsAppSending: jest.fn().mockResolvedValue(undefined),
    };
    const l = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(),
    };
    l.child.mockReturnValue(l);
    processor = new NotificationProcessor(
      service as never,
      {
        logger: l,
      } as never,
    );
  });

  it('runs processWhatsAppSending for a send-whatsapp job', async () => {
    await processor.process(job('send-whatsapp'));
    expect(service.processWhatsAppSending).toHaveBeenCalledWith(
      4,
      expect.anything(),
    );
  });

  it('fails the job (so BullMQ retries) when the instance is not authorized', async () => {
    service.isInstanceAuthorized.mockResolvedValue(false);
    await expect(processor.process(job('send-whatsapp'))).rejects.toThrow(
      'WhatsApp API not authorized',
    );
    expect(service.processWhatsAppSending).not.toHaveBeenCalled();
  });

  it('ignores an unknown job name', async () => {
    await expect(processor.process(job('other'))).resolves.toBeUndefined();
    expect(service.processWhatsAppSending).not.toHaveBeenCalled();
  });

  it('rethrows a sending error so the job is retried', async () => {
    service.processWhatsAppSending.mockRejectedValue(new Error('boom'));
    await expect(processor.process(job('send-whatsapp'))).rejects.toThrow(
      'boom',
    );
  });
});
