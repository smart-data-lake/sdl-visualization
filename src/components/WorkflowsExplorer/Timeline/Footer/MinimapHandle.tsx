import { styled } from '@mui/joy/styles';
import React from 'react';

type HandleProps = {
  which: 'left' | 'right';
  label: string;
  onDragStart: () => void;
  isZoomed: boolean;
  stackText?: boolean;
};

/** A grab handle on one edge of the minimap's viewport rectangle, labelled with its offset. */
const MinimapHandle: React.FC<HandleProps> = ({ label, onDragStart, which, isZoomed, stackText }) => (
  <Handle style={which === 'right' ? { right: '-5px' } : { left: '-5px' }} onMouseDown={onDragStart}>
    <GripLine />
    <GripLine />
    <GripLine />
    <HandleLabel $which={which} $isZoomed={isZoomed} $stackText={stackText}>
      {label}
    </HandleLabel>
  </Handle>
);

const Handle = styled('div')`
  position: absolute;
  top: 0.4375rem;
  height: 1.8125rem;
  width: 0.625rem;
  background: ${(p) => p.theme.vars.palette.primary.solidBg};
  z-index: 2;

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const GripLine = styled('div')`
  height: 1px;
  width: 0.25rem;
  background: ${(p) => p.theme.vars.palette.common.white};
  margin-bottom: 2px;
`;

const HandleLabel = styled('div')<{ $which: 'left' | 'right'; $isZoomed: boolean; $stackText?: boolean }>`
  position: absolute;
  top: 3.125rem;
  font-size: ${(p) => p.theme.vars.fontSize.sm};
  white-space: ${(p) => (p.$stackText && p.$isZoomed ? 'normal' : 'pre')};

  /*
   * The label normally hangs outside the viewport rectangle. Once the window is zoomed in far
   * enough that there is no room, it flips to the inside so it stays on screen. Exactly one of
   * left/right is set - the original set both, using invalid 'none' values that browsers dropped.
   */
  ${(p) => (((p.$which === 'left') !== p.$isZoomed) ? 'left: 0; right: auto;' : 'right: 100%; left: auto;')}
`;

export default MinimapHandle;
