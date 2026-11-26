import 'reflect-metadata';
import { NotificationController } from '../notification.controller';
import { WebhookTokenGuard } from '../webhook-token.guard';

describe('NotificationController webhook', () => {
  let service: {
    getContextualLogger: jest.Mock;
    changeOutgoingStatus: jest.Mock;
    changeIncomingStatus: jest.Mock;
    handleInstanceStateChange: jest.Mock;
  };
  let controller: NotificationController;
  const l = { debug: jest.fn(), error: jest.fn() };
  const instanceData = { idInstance: 1101, wid: 'w', typeInstance: 'whatsapp' };

  beforeEach(() => {
    service = {
      getContextualLogger: jest.fn().mockResolvedValue(l),
      changeOutgoingStatus: jest.fn(),
      changeIncomingStatus: jest.fn(),
      handleInstanceStateChange: jest.fn(),
    };
    controller = new NotificationController(service as never, {} as never);
  });

  it.each(['outgoingMessageStatus', 'outgoingAPIMessageStatus'] as const)(
    'routes %s to changeOutgoingStatus',
    async (typeWebhook) => {
      const result = await controller.handleWebHook(
        {
          typeWebhook,
          chatId: '77071234567@c.us',
          instanceData,
          timestamp: 1,
          idMessage: 'ext-1',
          status: 'read',
          sendByApi: true,
        },
        {},
      );
      expect(service.changeOutgoingStatus).toHaveBeenCalledWith(
        'ext-1',
        'read',
        l,
      );
      expect(result).toEqual({ ok: true });
    },
  );

  it('routes incomingMessageReceived to changeIncomingStatus with the sender chatId', async () => {
    await controller.handleWebHook(
      {
        typeWebhook: 'incomingMessageReceived',
        instanceData,
        timestamp: 1,
        idMessage: 'in-1',
        senderData: { chatId: '77071234567@c.us', sender: 's' },
        messageData: {
          typeMessage: 'textMessage',
          textMessageData: { textMessage: '1' },
        },
      },
      {},
    );
    expect(service.changeIncomingStatus).toHaveBeenCalledWith(
      '77071234567@c.us',
      l,
    );
  });

  it('routes stateInstanceChanged to handleInstanceStateChange', async () => {
    await controller.handleWebHook(
      {
        typeWebhook: 'stateInstanceChanged',
        instanceData,
        timestamp: 123,
        stateInstance: 'authorized',
      },
      {},
    );
    expect(service.handleInstanceStateChange).toHaveBeenCalledWith(
      1101,
      'authorized',
      123,
      l,
    );
  });

  it('answers ok and does nothing for an unsupported webhook type', async () => {
    const result = await controller.handleWebHook(
      { typeWebhook: 'deviceInfo' } as never,
      {},
    );
    expect(result).toEqual({ ok: true });
    expect(service.changeOutgoingStatus).not.toHaveBeenCalled();
    expect(service.changeIncomingStatus).not.toHaveBeenCalled();
    expect(service.handleInstanceStateChange).not.toHaveBeenCalled();
  });

  it('rethrows a processing error', async () => {
    service.changeOutgoingStatus.mockRejectedValue(new Error('db'));
    await expect(
      controller.handleWebHook(
        {
          typeWebhook: 'outgoingMessageStatus',
          idMessage: 'x',
          status: 'sent',
        } as never,
        {},
      ),
    ).rejects.toThrow('db');
  });

  it('protects the webhook with WebhookTokenGuard', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- нужен сам метод как ключ метаданных
    const handler = NotificationController.prototype.handleWebHook;
    const guards = Reflect.getMetadata('__guards__', handler) as unknown[];
    expect(guards).toContain(WebhookTokenGuard);
  });
});
