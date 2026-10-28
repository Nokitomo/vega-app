import {useCallback, useEffect, useRef, useState} from 'react';
import {Animated} from 'react-native';

export const HERO_INTERVAL_MS = 10000;
// Critical damping (ratio 1), matching the reference's nominal spring values.
const SPRING = {
  stiffness: 1500,
  damping: 2 * Math.sqrt(1500),
  mass: 1,
  overshootClamping: true,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
  useNativeDriver: true,
};

export function heroSwipeTarget(page: number, count: number, width: number, dx: number, vx: number) {
  const deliberate = Math.abs(dx) >= width * 0.18 ||
    (Math.abs(dx) >= 20 && Math.abs(vx) >= 0.5 && Math.sign(dx) === Math.sign(vx));
  if (!deliberate) {return page;}
  return Math.max(0, Math.min(count - 1, page + (dx < 0 ? 1 : -1)));
}

/** Presentation only. Metadata readiness and selection stay owned by Hero. */
export function useHeroCarouselMotion({
  requestedLink, ready, active, reducedMotion,
}: {requestedLink: string; ready: boolean; active: boolean; reducedMotion: boolean}) {
  const [displayedLink, setDisplayedLink] = useState('');
  const displayed = useRef('');
  const [outgoing, setOutgoing] = useState<{link: string; opacity: number} | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const blend = useRef(new Animated.Value(1)).current;
  const dragOpacity = useRef(new Animated.Value(1)).current;
  const dragValue = useRef(1);
  const generation = useRef(0);
  const dragGeneration = useRef(0);
  const blending = useRef<Animated.CompositeAnimation | null>(null);
  const restoring = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const token = ++generation.current;
    ++dragGeneration.current;
    blending.current?.stop();
    restoring.current?.stop();
    const exitOpacity = dragValue.current;
    dragValue.current = 1;
    dragOpacity.setValue(1);
    blend.setValue(1);
    setOutgoing(null);
    setTransitioning(false);
    setDragging(false);

    if (active && ready && requestedLink && requestedLink !== displayed.current) {
      const previous = displayed.current;
      displayed.current = requestedLink;
      setDisplayedLink(requestedLink);
      if (previous && !reducedMotion) {
        setOutgoing({link: previous, opacity: exitOpacity});
        setTransitioning(true);
        blend.setValue(0);
        blending.current = Animated.spring(blend, {...SPRING, toValue: 1});
        blending.current.start(({finished}) => {
          if (finished && token === generation.current) {
            setOutgoing(null);
            setTransitioning(false);
          }
        });
      }
    }
    return () => {
      ++generation.current;
      ++dragGeneration.current;
      blending.current?.stop();
      restoring.current?.stop();
    };
  }, [requestedLink, ready, active, reducedMotion, blend, dragOpacity]);

  const beginDrag = useCallback(() => {
    ++dragGeneration.current;
    restoring.current?.stop();
    dragValue.current = 1;
    dragOpacity.setValue(1);
    setDragging(true);
  }, [dragOpacity]);
  const moveDrag = useCallback((dx: number, width: number, canMove: boolean) => {
    const opacity = reducedMotion || !canMove ? 1 : 1 - Math.min(Math.abs(dx) / width, 0.85);
    dragValue.current = opacity;
    dragOpacity.setValue(opacity);
  }, [dragOpacity, reducedMotion]);
  const endDrag = useCallback(() => {
    const dragToken = ++dragGeneration.current;
    setDragging(false);
    // A cancelled gesture (including responder termination) must never leave
    // the card dimmed. A ready selection will interrupt this with the blend.
    if (reducedMotion) {
      dragValue.current = 1;
      dragOpacity.setValue(1);
    } else {
      restoring.current?.stop();
      const token = generation.current;
      restoring.current = Animated.spring(dragOpacity, {...SPRING, toValue: 1});
      restoring.current.start(({finished}) => {
        if (finished && token === generation.current && dragToken === dragGeneration.current) {
          dragValue.current = 1;
        }
      });
    }
  }, [dragOpacity, reducedMotion]);

  return {displayedLink, outgoing, blend, dragOpacity, transitioning, dragging,
    beginDrag, moveDrag, endDrag};
}
