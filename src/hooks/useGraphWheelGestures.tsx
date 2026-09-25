import { RefObject, useEffect } from 'react';
import { ReactFlowInstance } from 'reactflow';
import { applyWheelAction, GESTURE_GAP_MS, guessWheelDevice, Viewport, WheelDevice, wheelAction, zoomAround } from '../util/ConfigExplorer/wheelGestures';

// Safari's pinch, which it reports as gesture events instead of a Ctrl+wheel
type GestureEvent = UIEvent & { scale: number, clientX: number, clientY: number };

/*
    Takes the wheel away from ReactFlow on the graph itself: a touchpad slide pans, a pinch zooms,
    a mouse wheel still zooms. Listens in the capture phase so ReactFlow's own wheel handler never runs.
*/
export function useGraphWheelGestures(container: RefObject<HTMLElement | undefined>, reactFlow: ReactFlowInstance, minZoom: number, maxZoom: number, mounted: boolean) {
  useEffect(() => {
    const element = container.current;
    if (!element || !mounted) return;
    let last: { device: WheelDevice, time: number } | undefined;
    let gestureStart: Viewport | undefined;

    const onGraph = (event: Event) => {
      const target = event.target as Element | null;
      return !!target?.closest('.react-flow__renderer') && !target.closest('.nowheel');
    };
    const pointIn = (event: { clientX: number, clientY: number }) => {
      const rect = (element.querySelector('.react-flow') ?? element).getBoundingClientRect(); // the viewport's origin
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onWheel = (event: WheelEvent) => {
      if (!onGraph(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (gestureStart) return; // Safari may add Ctrl+wheel events to its own pinch
      const sameGesture = last && event.timeStamp - last.time < GESTURE_GAP_MS;
      const device = sameGesture ? last!.device : guessWheelDevice(event);
      last = { device, time: event.timeStamp };
      reactFlow.setViewport(applyWheelAction(reactFlow.getViewport(), wheelAction(event, device), pointIn(event), minZoom, maxZoom));
    };
    const onGestureStart = (event: Event) => {
      if (!onGraph(event)) return;
      event.preventDefault();
      gestureStart = reactFlow.getViewport();
    };
    const onGestureChange = (event: Event) => {
      if (!gestureStart) return;
      event.preventDefault();
      const gesture = event as GestureEvent;
      reactFlow.setViewport(zoomAround(gestureStart, pointIn(gesture), gesture.scale, minZoom, maxZoom));
    };
    const onGestureEnd = (event: Event) => {
      if (!gestureStart) return;
      event.preventDefault();
      gestureStart = undefined;
    };

    element.addEventListener('wheel', onWheel, { capture: true, passive: false });
    element.addEventListener('gesturestart', onGestureStart);
    element.addEventListener('gesturechange', onGestureChange);
    element.addEventListener('gestureend', onGestureEnd);
    return () => {
      element.removeEventListener('wheel', onWheel, { capture: true });
      element.removeEventListener('gesturestart', onGestureStart);
      element.removeEventListener('gesturechange', onGestureChange);
      element.removeEventListener('gestureend', onGestureEnd);
    };
  }, [container, reactFlow, minZoom, maxZoom, mounted]);
}
