// 1. RCTEventEmitter was deprecated in favor of RCTModernEventEmitter interface
// 2. Event#init() with only viewTag was deprecated in favor of two arg c-tor
// 3. Event#receiveEvent() with 3 args was deprecated in favor of 4 args version
// ref: https://github.com/facebook/react-native/commit/2fbbdbb2ce897e8da3f471b08b93f167d566db1d
@file:Suppress("DEPRECATION")

package com.swmansion.gesturehandler.react

import androidx.core.util.Pools
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event
import com.facebook.react.uimanager.events.RCTEventEmitter
import com.swmansion.gesturehandler.core.GestureHandler
import com.swmansion.gesturehandler.react.eventbuilders.GestureHandlerEventDataBuilder

class RNGestureHandlerEvent private constructor() : Event<RNGestureHandlerEvent>() {
  private var dataBuilder: GestureHandlerEventDataBuilder<*>? = null
  private var coalescingKey: Short = 0

  // On the new architecture, native animated expects event names prefixed with `top` instead of `on`,
  // since we know when the native animated node is the target of the event we can use the different
  // event name where appropriate.
  // TODO: This is a workaround not as solution, but doing this properly would require a total overhaul of
  // how GH sends events (which needs to be done, but maybe wait until the RN's apis stop changing)
  private var useTopPrefixedName: Boolean = false

  private fun <T : GestureHandler<T>> init(
    handler: T,
    dataBuilder: GestureHandlerEventDataBuilder<T>,
    useNativeAnimatedName: Boolean
  ) {
    super.init(handler.view!!.id)
    this.dataBuilder = dataBuilder
    this.useTopPrefixedName = useNativeAnimatedName
    coalescingKey = handler.eventCoalescingKey
  }

  override fun onDispose() {
    dataBuilder = null
    EVENTS_POOL.release(this)
  }

  override fun getEventName() = if (useTopPrefixedName) NATIVE_ANIMATED_EVENT_NAME else EVENT_NAME

  override fun canCoalesce() = true

  override fun getCoalescingKey() = coalescingKey

  override fun dispatch(rctEventEmitter: RCTEventEmitter) {
    rctEventEmitter.receiveEvent(viewTag, EVENT_NAME, createEventData(dataBuilder!!))
  }

  companion object {
    const val EVENT_NAME = "onGestureHandlerEvent"
    const val NATIVE_ANIMATED_EVENT_NAME = "topGestureHandlerEvent"
    private const val TOUCH_EVENTS_POOL_SIZE = 7 // magic
    private val EVENTS_POOL = Pools.SynchronizedPool<RNGestureHandlerEvent>(TOUCH_EVENTS_POOL_SIZE)

    fun <T : GestureHandler<T>> obtain(
      handler: T,
      dataBuilder: GestureHandlerEventDataBuilder<T>,
      useTopPrefixedName: Boolean = false
    ): RNGestureHandlerEvent =
      (EVENTS_POOL.acquire() ?: RNGestureHandlerEvent()).apply {
        init(handler, dataBuilder, useTopPrefixedName)
      }

    fun createEventData(
      dataBuilder: GestureHandlerEventDataBuilder<*>
    ): WritableMap = Arguments.createMap().apply {
      dataBuilder.buildEventData(this)
    }
  }
}