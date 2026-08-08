export class EventBus {
  private static instance: EventBus;

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public async publish(event: {
    eventType: string;
    entity: string;
    entityId: string;
    companyId: string;
    brandId?: string;
    payload: any;
    timestamp: Date;
  }): Promise<void> {
    console.log(`[EventBus] Published event: ${event.eventType}`, event);
  }
}
