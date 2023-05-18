import { FederatedEvent } from './FederatedEvent';

export interface IEventTarget {
  // emitter: EventEmitter;

  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void;

  removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void;

  dispatchEvent: <T extends FederatedEvent>(e: T, skipPropagate?: boolean) => boolean;
}