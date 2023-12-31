import { State } from '../../State';
import GestureHandler from '../handlers/GestureHandler';
export default class GestureHandlerOrchestrator {
    private static instance;
    private gestureHandlers;
    private awaitingHandlers;
    private handlingChangeSemaphore;
    private activationIndex;
    private constructor();
    private scheduleFinishedHandlersCleanup;
    private cleanHandler;
    removeHandlerFromOrchestrator(handler: GestureHandler): void;
    private cleanupFinishedHandlers;
    private hasOtherHandlerToWaitFor;
    private tryActivate;
    private shouldActivate;
    private cleanupAwaitingHandlers;
    onHandlerStateChange(handler: GestureHandler, newState: State, oldState: State, sendIfDisabled?: boolean): void;
    private makeActive;
    private addAwaitingHandler;
    recordHandlerIfNotPresent(handler: GestureHandler): void;
    private shouldHandlerWaitForOther;
    private canRunSimultaneously;
    private shouldHandlerBeCancelledBy;
    private checkOverlap;
    private isFinished;
    cancelMouseAndPenGestures(currentHandler: GestureHandler): void;
    static getInstance(): GestureHandlerOrchestrator;
}
