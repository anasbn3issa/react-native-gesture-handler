"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _State = require("../../State");

var _interfaces = require("../interfaces");

var _GestureHandlerOrchestrator = _interopRequireDefault(require("../tools/GestureHandlerOrchestrator"));

var _InteractionManager = _interopRequireDefault(require("../tools/InteractionManager"));

var _PointerTracker = _interopRequireDefault(require("../tools/PointerTracker"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class GestureHandler {
  // Orchestrator properties
  constructor(delegate) {
    _defineProperty(this, "lastSentState", null);

    _defineProperty(this, "currentState", _State.State.UNDETERMINED);

    _defineProperty(this, "shouldCancellWhenOutside", false);

    _defineProperty(this, "hasCustomActivationCriteria", false);

    _defineProperty(this, "enabled", false);

    _defineProperty(this, "viewRef", void 0);

    _defineProperty(this, "propsRef", void 0);

    _defineProperty(this, "handlerTag", void 0);

    _defineProperty(this, "config", {
      enabled: false
    });

    _defineProperty(this, "tracker", new _PointerTracker.default());

    _defineProperty(this, "activationIndex", 0);

    _defineProperty(this, "awaiting", false);

    _defineProperty(this, "active", false);

    _defineProperty(this, "shouldResetProgress", false);

    _defineProperty(this, "pointerType", _interfaces.PointerType.NONE);

    _defineProperty(this, "delegate", void 0);

    _defineProperty(this, "sendEvent", (newState, oldState) => {
      const {
        onGestureHandlerEvent,
        onGestureHandlerStateChange
      } = this.propsRef.current;
      const resultEvent = this.transformEventData(newState, oldState); // In the new API oldState field has to be undefined, unless we send event state changed
      // Here the order is flipped to avoid workarounds such as making backup of the state and setting it to undefined first, then changing it back
      // Flipping order with setting oldState to undefined solves issue, when events were being sent twice instead of once
      // However, this may cause trouble in the future (but for now we don't know that)

      if (this.lastSentState !== newState) {
        this.lastSentState = newState;
        invokeNullableMethod(onGestureHandlerStateChange, resultEvent);
      }

      if (this.currentState === _State.State.ACTIVE) {
        resultEvent.nativeEvent.oldState = undefined;
        invokeNullableMethod(onGestureHandlerEvent, resultEvent);
      }
    });

    this.delegate = delegate;
  } //
  // Initializing handler
  //


  init(viewRef, propsRef) {
    this.propsRef = propsRef;
    this.viewRef = viewRef;
    this.currentState = _State.State.UNDETERMINED;
    this.delegate.init(viewRef, this);
  }

  attachEventManager(manager) {
    manager.setOnPointerDown(this.onPointerDown.bind(this));
    manager.setOnPointerAdd(this.onPointerAdd.bind(this));
    manager.setOnPointerUp(this.onPointerUp.bind(this));
    manager.setOnPointerRemove(this.onPointerRemove.bind(this));
    manager.setOnPointerMove(this.onPointerMove.bind(this));
    manager.setOnPointerEnter(this.onPointerEnter.bind(this));
    manager.setOnPointerLeave(this.onPointerLeave.bind(this));
    manager.setOnPointerCancel(this.onPointerCancel.bind(this));
    manager.setOnPointerOutOfBounds(this.onPointerOutOfBounds.bind(this));
    manager.setOnPointerMoveOver(this.onPointerMoveOver.bind(this));
    manager.setOnPointerMoveOut(this.onPointerMoveOut.bind(this));
    manager.setListeners();
  } //
  // Resetting handler
  //


  onCancel() {}

  onReset() {}

  resetProgress() {}

  reset() {
    this.tracker.resetTracker();
    this.onReset();
    this.resetProgress();
    this.delegate.reset();
    this.currentState = _State.State.UNDETERMINED;
  } //
  // State logic
  //


  moveToState(newState, sendIfDisabled) {
    if (this.currentState === newState) {
      return;
    }

    const oldState = this.currentState;
    this.currentState = newState;

    if (this.tracker.getTrackedPointersCount() > 0 && this.config.needsPointerData && this.isFinished()) {
      this.cancelTouches();
    }

    _GestureHandlerOrchestrator.default.getInstance().onHandlerStateChange(this, newState, oldState, sendIfDisabled);

    this.onStateChange(newState, oldState);
  }

  onStateChange(_newState, _oldState) {}

  begin() {
    if (!this.checkHitSlop()) {
      return;
    }

    if (this.currentState === _State.State.UNDETERMINED) {
      this.moveToState(_State.State.BEGAN);
    }
  }
  /**
   * @param {boolean} sendIfDisabled - Used when handler becomes disabled. With this flag orchestrator will be forced to send fail event
   */


  fail(sendIfDisabled) {
    if (this.currentState === _State.State.ACTIVE || this.currentState === _State.State.BEGAN) {
      // Here the order of calling the delegate and moveToState is important.
      // At this point we can use currentState as previuos state, because immediately after changing cursor we call moveToState method.
      this.delegate.onFail();
      this.moveToState(_State.State.FAILED, sendIfDisabled);
    }

    this.resetProgress();
  }
  /**
   * @param {boolean} sendIfDisabled - Used when handler becomes disabled. With this flag orchestrator will be forced to send cancel event
   */


  cancel(sendIfDisabled) {
    if (this.currentState === _State.State.ACTIVE || this.currentState === _State.State.UNDETERMINED || this.currentState === _State.State.BEGAN) {
      this.onCancel(); // Same as above - order matters

      this.delegate.onCancel();
      this.moveToState(_State.State.CANCELLED, sendIfDisabled);
    }
  }

  activate(_force = false) {
    if (this.currentState === _State.State.UNDETERMINED || this.currentState === _State.State.BEGAN) {
      this.delegate.onActivate();
      this.moveToState(_State.State.ACTIVE);
    }
  }

  end() {
    if (this.currentState === _State.State.BEGAN || this.currentState === _State.State.ACTIVE) {
      // Same as above - order matters
      this.delegate.onEnd();
      this.moveToState(_State.State.END);
    }

    this.resetProgress();
  } //
  // Methods for orchestrator
  //


  isAwaiting() {
    return this.awaiting;
  }

  setAwaiting(value) {
    this.awaiting = value;
  }

  isActive() {
    return this.active;
  }

  setActive(value) {
    this.active = value;
  }

  getShouldResetProgress() {
    return this.shouldResetProgress;
  }

  setShouldResetProgress(value) {
    this.shouldResetProgress = value;
  }

  getActivationIndex() {
    return this.activationIndex;
  }

  setActivationIndex(value) {
    this.activationIndex = value;
  }

  shouldWaitForHandlerFailure(handler) {
    if (handler === this) {
      return false;
    }

    return _InteractionManager.default.getInstance().shouldWaitForHandlerFailure(this, handler);
  }

  shouldRequireToWaitForFailure(handler) {
    if (handler === this) {
      return false;
    }

    return _InteractionManager.default.getInstance().shouldRequireHandlerToWaitForFailure(this, handler);
  }

  shouldRecognizeSimultaneously(handler) {
    if (handler === this) {
      return true;
    }

    return _InteractionManager.default.getInstance().shouldRecognizeSimultaneously(this, handler);
  }

  shouldBeCancelledByOther(handler) {
    if (handler === this) {
      return false;
    }

    return _InteractionManager.default.getInstance().shouldHandlerBeCancelledBy(this, handler);
  } //
  // Event actions
  //


  onPointerDown(event) {
    _GestureHandlerOrchestrator.default.getInstance().recordHandlerIfNotPresent(this);

    this.pointerType = event.pointerType;

    if (this.pointerType === _interfaces.PointerType.TOUCH) {
      _GestureHandlerOrchestrator.default.getInstance().cancelMouseAndPenGestures(this);
    }

    if (this.config.needsPointerData) {
      this.sendTouchEvent(event);
    }
  } // Adding another pointer to existing ones


  onPointerAdd(event) {
    if (this.config.needsPointerData) {
      this.sendTouchEvent(event);
    }
  }

  onPointerUp(event) {
    if (this.config.needsPointerData) {
      this.sendTouchEvent(event);
    }
  } // Removing pointer, when there is more than one pointers


  onPointerRemove(event) {
    if (this.config.needsPointerData) {
      this.sendTouchEvent(event);
    }
  }

  onPointerMove(event) {
    this.tryToSendMoveEvent(false);

    if (this.config.needsPointerData) {
      this.sendTouchEvent(event);
    }
  }

  onPointerLeave(event) {
    if (this.shouldCancellWhenOutside) {
      switch (this.currentState) {
        case _State.State.ACTIVE:
          this.cancel();
          break;

        case _State.State.BEGAN:
          this.fail();
          break;
      }

      return;
    }

    if (this.config.needsPointerData) {
      this.sendTouchEvent(event);
    }
  }

  onPointerEnter(event) {
    if (this.config.needsPointerData) {
      this.sendTouchEvent(event);
    }
  }

  onPointerCancel(event) {
    if (this.config.needsPointerData) {
      this.sendTouchEvent(event);
    }

    this.cancel();
    this.reset();
  }

  onPointerOutOfBounds(event) {
    this.tryToSendMoveEvent(true);

    if (this.config.needsPointerData) {
      this.sendTouchEvent(event);
    }
  }

  onPointerMoveOver(_event) {// used only by hover gesture handler atm
  }

  onPointerMoveOut(_event) {// used only by hover gesture handler atm
  }

  tryToSendMoveEvent(out) {
    if (this.enabled && this.active && (!out || out && !this.shouldCancellWhenOutside)) {
      this.sendEvent(this.currentState, this.currentState);
    }
  }

  sendTouchEvent(event) {
    if (!this.enabled) {
      return;
    }

    const {
      onGestureHandlerEvent
    } = this.propsRef.current;
    const touchEvent = this.transformTouchEvent(event);

    if (touchEvent) {
      invokeNullableMethod(onGestureHandlerEvent, touchEvent);
    }
  } //
  // Events Sending
  //


  transformEventData(newState, oldState) {
    return {
      nativeEvent: {
        numberOfPointers: this.tracker.getTrackedPointersCount(),
        state: newState,
        pointerInside: this.delegate.isPointerInBounds({
          x: this.tracker.getLastAvgX(),
          y: this.tracker.getLastAvgY()
        }),
        ...this.transformNativeEvent(),
        handlerTag: this.handlerTag,
        target: this.viewRef,
        oldState: newState !== oldState ? oldState : undefined
      },
      timeStamp: Date.now()
    };
  }

  transformTouchEvent(event) {
    var _event$touchEventType;

    const rect = this.delegate.measureView();
    const all = [];
    const changed = [];
    const trackerData = this.tracker.getData(); // This if handles edge case where all pointers have been cancelled
    // When pointercancel is triggered, reset method is called. This means that tracker will be reset after first pointer being cancelled
    // The problem is, that handler will receive another pointercancel event from the rest of the pointers
    // To avoid crashing, we don't send event if tracker tracks no pointers, i.e. has been reset

    if (trackerData.size === 0 || !trackerData.has(event.pointerId)) {
      return;
    }

    trackerData.forEach((element, key) => {
      const id = this.tracker.getMappedTouchEventId(key);
      all.push({
        id: id,
        x: element.lastX - rect.pageX,
        y: element.lastY - rect.pageY,
        absoluteX: element.lastX,
        absoluteY: element.lastY
      });
    }); // Each pointer sends its own event, so we want changed touches to contain only the pointer that has changed.
    // However, if the event is cancel, we want to cancel all pointers to avoid crashes

    if (event.eventType !== _interfaces.EventTypes.CANCEL) {
      changed.push({
        id: this.tracker.getMappedTouchEventId(event.pointerId),
        x: event.x - rect.pageX,
        y: event.y - rect.pageY,
        absoluteX: event.x,
        absoluteY: event.y
      });
    } else {
      trackerData.forEach((element, key) => {
        const id = this.tracker.getMappedTouchEventId(key);
        changed.push({
          id: id,
          x: element.lastX - rect.pageX,
          y: element.lastY - rect.pageY,
          absoluteX: element.lastX,
          absoluteY: element.lastY
        });
      });
    }

    let eventType = _interfaces.TouchEventType.UNDETERMINED;

    switch (event.eventType) {
      case _interfaces.EventTypes.DOWN:
      case _interfaces.EventTypes.ADDITIONAL_POINTER_DOWN:
        eventType = _interfaces.TouchEventType.DOWN;
        break;

      case _interfaces.EventTypes.UP:
      case _interfaces.EventTypes.ADDITIONAL_POINTER_UP:
        eventType = _interfaces.TouchEventType.UP;
        break;

      case _interfaces.EventTypes.MOVE:
        eventType = _interfaces.TouchEventType.MOVE;
        break;

      case _interfaces.EventTypes.CANCEL:
        eventType = _interfaces.TouchEventType.CANCELLED;
        break;
    } // Here, when we receive up event, we want to decrease number of touches
    // That's because we want handler to send information that there's one pointer less
    // However, we still want this pointer to be present in allTouches array, so that its data can be accessed


    let numberOfTouches = all.length;

    if (event.eventType === _interfaces.EventTypes.UP || event.eventType === _interfaces.EventTypes.ADDITIONAL_POINTER_UP) {
      --numberOfTouches;
    }

    return {
      nativeEvent: {
        handlerTag: this.handlerTag,
        state: this.currentState,
        eventType: (_event$touchEventType = event.touchEventType) !== null && _event$touchEventType !== void 0 ? _event$touchEventType : eventType,
        changedTouches: changed,
        allTouches: all,
        numberOfTouches: numberOfTouches
      },
      timeStamp: Date.now()
    };
  }

  cancelTouches() {
    const rect = this.delegate.measureView();
    const all = [];
    const changed = [];
    const trackerData = this.tracker.getData();

    if (trackerData.size === 0) {
      return;
    }

    trackerData.forEach((element, key) => {
      const id = this.tracker.getMappedTouchEventId(key);
      all.push({
        id: id,
        x: element.lastX - rect.pageX,
        y: element.lastY - rect.pageY,
        absoluteX: element.lastX,
        absoluteY: element.lastY
      });
      changed.push({
        id: id,
        x: element.lastX - rect.pageX,
        y: element.lastY - rect.pageY,
        absoluteX: element.lastX,
        absoluteY: element.lastY
      });
    });
    const cancelEvent = {
      nativeEvent: {
        handlerTag: this.handlerTag,
        state: this.currentState,
        eventType: _interfaces.TouchEventType.CANCELLED,
        changedTouches: changed,
        allTouches: all,
        numberOfTouches: all.length
      },
      timeStamp: Date.now()
    };
    const {
      onGestureHandlerEvent
    } = this.propsRef.current;
    invokeNullableMethod(onGestureHandlerEvent, cancelEvent);
  }

  transformNativeEvent() {
    // those properties are shared by most handlers and if not this method will be overriden
    const rect = this.delegate.measureView();
    return {
      x: this.tracker.getLastAvgX() - rect.pageX,
      y: this.tracker.getLastAvgY() - rect.pageY,
      absoluteX: this.tracker.getLastAvgX(),
      absoluteY: this.tracker.getLastAvgY()
    };
  } //
  // Handling config
  //


  updateGestureConfig({
    enabled = true,
    ...props
  }) {
    this.config = {
      enabled: enabled,
      ...props
    };
    this.enabled = enabled;

    if (this.config.shouldCancelWhenOutside !== undefined) {
      this.setShouldCancelWhenOutside(this.config.shouldCancelWhenOutside);
    }

    this.validateHitSlops();

    if (this.enabled) {
      return;
    }

    switch (this.currentState) {
      case _State.State.ACTIVE:
        this.fail(true);
        break;

      case _State.State.UNDETERMINED:
        _GestureHandlerOrchestrator.default.getInstance().removeHandlerFromOrchestrator(this);

        break;

      default:
        this.cancel(true);
        break;
    }
  }

  checkCustomActivationCriteria(criterias) {
    for (const key in this.config) {
      if (criterias.indexOf(key) >= 0) {
        this.hasCustomActivationCriteria = true;
      }
    }
  }

  validateHitSlops() {
    if (!this.config.hitSlop) {
      return;
    }

    if (this.config.hitSlop.left !== undefined && this.config.hitSlop.right !== undefined && this.config.hitSlop.width !== undefined) {
      throw new Error('HitSlop Error: Cannot define left, right and width at the same time');
    }

    if (this.config.hitSlop.width !== undefined && this.config.hitSlop.left === undefined && this.config.hitSlop.right === undefined) {
      throw new Error('HitSlop Error: When width is defined, either left or right has to be defined');
    }

    if (this.config.hitSlop.height !== undefined && this.config.hitSlop.top !== undefined && this.config.hitSlop.bottom !== undefined) {
      throw new Error('HitSlop Error: Cannot define top, bottom and height at the same time');
    }

    if (this.config.hitSlop.height !== undefined && this.config.hitSlop.top === undefined && this.config.hitSlop.bottom === undefined) {
      throw new Error('HitSlop Error: When height is defined, either top or bottom has to be defined');
    }
  }

  checkHitSlop() {
    if (!this.config.hitSlop) {
      return true;
    }

    const {
      width,
      height
    } = this.delegate.measureView();
    let left = 0;
    let top = 0;
    let right = width;
    let bottom = height;

    if (this.config.hitSlop.horizontal !== undefined) {
      left -= this.config.hitSlop.horizontal;
      right += this.config.hitSlop.horizontal;
    }

    if (this.config.hitSlop.vertical !== undefined) {
      top -= this.config.hitSlop.vertical;
      bottom += this.config.hitSlop.vertical;
    }

    if (this.config.hitSlop.left !== undefined) {
      left = -this.config.hitSlop.left;
    }

    if (this.config.hitSlop.right !== undefined) {
      right = width + this.config.hitSlop.right;
    }

    if (this.config.hitSlop.top !== undefined) {
      top = -this.config.hitSlop.top;
    }

    if (this.config.hitSlop.bottom !== undefined) {
      bottom = width + this.config.hitSlop.bottom;
    }

    if (this.config.hitSlop.width !== undefined) {
      if (this.config.hitSlop.left !== undefined) {
        right = left + this.config.hitSlop.width;
      } else if (this.config.hitSlop.right !== undefined) {
        left = right - this.config.hitSlop.width;
      }
    }

    if (this.config.hitSlop.height !== undefined) {
      if (this.config.hitSlop.top !== undefined) {
        bottom = top + this.config.hitSlop.height;
      } else if (this.config.hitSlop.bottom !== undefined) {
        top = bottom - this.config.hitSlop.height;
      }
    }

    const rect = this.delegate.measureView();
    const offsetX = this.tracker.getLastX() - rect.pageX;
    const offsetY = this.tracker.getLastY() - rect.pageY;

    if (offsetX >= left && offsetX <= right && offsetY >= top && offsetY <= bottom) {
      return true;
    }

    return false;
  }

  resetConfig() {} //
  // Getters and setters
  //


  getTag() {
    return this.handlerTag;
  }

  setTag(tag) {
    this.handlerTag = tag;
  }

  getConfig() {
    return this.config;
  }

  getDelegate() {
    return this.delegate;
  }

  getTracker() {
    return this.tracker;
  }

  getTrackedPointersID() {
    return this.tracker.getTrackedPointersID();
  }

  getState() {
    return this.currentState;
  }

  isEnabled() {
    return this.enabled;
  }

  isFinished() {
    return this.currentState === _State.State.END || this.currentState === _State.State.FAILED || this.currentState === _State.State.CANCELLED;
  }

  setShouldCancelWhenOutside(shouldCancel) {
    this.shouldCancellWhenOutside = shouldCancel;
  }

  getShouldCancelWhenOutside() {
    return this.shouldCancellWhenOutside;
  }

  getPointerType() {
    return this.pointerType;
  }

}

exports.default = GestureHandler;

function invokeNullableMethod(method, event) {
  if (!method) {
    return;
  }

  if (typeof method === 'function') {
    method(event);
    return;
  }

  if ('__getHandler' in method && typeof method.__getHandler === 'function') {
    const handler = method.__getHandler();

    invokeNullableMethod(handler, event);
    return;
  }

  if (!('__nodeConfig' in method)) {
    return;
  }

  const {
    argMapping
  } = method.__nodeConfig;

  if (!Array.isArray(argMapping)) {
    return;
  }

  for (const [index, [key, value]] of argMapping.entries()) {
    if (!(key in event.nativeEvent)) {
      continue;
    } // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access


    const nativeValue = event.nativeEvent[key]; // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access

    if (value !== null && value !== void 0 && value.setValue) {
      //Reanimated API
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      value.setValue(nativeValue);
    } else {
      //RN Animated API
      method.__nodeConfig.argMapping[index] = [key, nativeValue];
    }
  }

  return;
}
//# sourceMappingURL=GestureHandler.js.map