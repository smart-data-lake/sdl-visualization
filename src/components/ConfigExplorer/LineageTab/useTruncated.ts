import { MouseEvent, useState } from 'react';

/**
 * Whether a text cut off by an ellipsis is truncated, measured when the pointer enters it - so that
 * its tooltip, which only repeats the text, opens only where the text is not all there.
 */
export function useTruncated() {
    const [truncated, setTruncated] = useState(false);
    const onMouseEnter = ({currentTarget}: MouseEvent<HTMLElement>) =>
        setTruncated(currentTarget.scrollWidth > currentTarget.clientWidth);
    return {truncated, onMouseEnter};
}
