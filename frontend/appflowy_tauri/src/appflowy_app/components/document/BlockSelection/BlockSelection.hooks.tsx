import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch } from '$app/stores/store';
import { rectSelectionActions } from "@/appflowy_app/stores/reducers/document/slice";
import { useNodesRect } from '$app/components/document/BlockSelection/NodesRect.hooks';
import { setRectSelectionThunk } from "$app_reducers/document/async-actions/rect_selection";

export function useBlockSelection({
  container,
  onDragging,
}: {
  container: HTMLDivElement;
  onDragging?: (_isDragging: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const disaptch = useAppDispatch();

  const [isDragging, setDragging] = useState(false);
  const startPointRef = useRef<number[]>([]);

  const { getIntersectedBlockIds } = useNodesRect(container);

  useEffect(() => {
    onDragging?.(isDragging);
  }, [isDragging, onDragging]);

  const [rect, setRect] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  const style = useMemo(() => {
    if (!rect) return;
    const { startX, endX, startY, endY } = rect;
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    return {
      left: x - container.scrollLeft + 'px',
      top: y - container.scrollTop + 'px',
      width: width + 'px',
      height: height + 'px',
    };
  }, [container.scrollLeft, container.scrollTop, rect]);

  const isPointInBlock = useCallback((target: HTMLElement | null) => {
    let node = target;
    while (node) {
      if (node.getAttribute('data-block-id')) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }, []);

  const handleDragStart = useCallback(
    (e: MouseEvent) => {
      if (isPointInBlock(e.target as HTMLElement)) {
        return;
      }
      e.preventDefault();
      setDragging(true);

      const startX = e.clientX + container.scrollLeft;
      const startY = e.clientY + container.scrollTop;
      startPointRef.current = [startX, startY];
      setRect({
        startX,
        startY,
        endX: startX,
        endY: startY,
      });
    },
    [container.scrollLeft, container.scrollTop, isPointInBlock]
  );

  const updateSelctionsByPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return;
      const [startX, startY] = startPointRef.current;
      const endX = clientX + container.scrollLeft;
      const endY = clientY + container.scrollTop;

      const newRect = {
        startX,
        startY,
        endX,
        endY,
      };
      const blockIds = getIntersectedBlockIds(newRect);
      setRect(newRect);
      disaptch(setRectSelectionThunk(blockIds));
    },
    [container.scrollLeft, container.scrollTop, disaptch, getIntersectedBlockIds, isDragging]
  );

  const handleDraging = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();
      updateSelctionsByPoint(e.clientX, e.clientY);

      const { top, bottom } = container.getBoundingClientRect();
      if (e.clientY >= bottom) {
        const delta = e.clientY - bottom;
        container.scrollBy(0, delta);
      } else if (e.clientY <= top) {
        const delta = e.clientY - top;
        container.scrollBy(0, delta);
      }
    },
    [container, isDragging, updateSelctionsByPoint]
  );

  const handleDragEnd = useCallback(
    (e: MouseEvent) => {
      if (isPointInBlock(e.target as HTMLElement) && !isDragging) {
        disaptch(rectSelectionActions.updateSelections([]));
        return;
      }
      if (!isDragging) return;
      e.preventDefault();
      updateSelctionsByPoint(e.clientX, e.clientY);
      setDragging(false);
      setRect(null);
    },
    [disaptch, isDragging, isPointInBlock, updateSelctionsByPoint]
  );

  useEffect(() => {
    if (!ref.current) return;
    document.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDraging);
    document.addEventListener('mouseup', handleDragEnd);

    return () => {
      document.removeEventListener('mousedown', handleDragStart);
      document.removeEventListener('mousemove', handleDraging);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [handleDragStart, handleDragEnd, handleDraging]);

  return {
    isDragging,
    style,
    ref,
  };
}