import { AdaptedEvent, EventTypes, TouchEventType } from '../interfaces';
import EventManager from './EventManager';
export default class TouchEventManager extends EventManager<HTMLElement> {
    setListeners(): void;
    protected mapEvent(event: TouchEvent, eventType: EventTypes, index: number, touchEventType: TouchEventType): AdaptedEvent;
}
