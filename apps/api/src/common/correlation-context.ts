import { AsyncLocalStorage } from 'async_hooks';

export type CorrelationStore = { correlationId: string };

export const correlationContext = new AsyncLocalStorage<CorrelationStore>();

export function getCorrelationId(): string | undefined {
  return correlationContext.getStore()?.correlationId;
}
