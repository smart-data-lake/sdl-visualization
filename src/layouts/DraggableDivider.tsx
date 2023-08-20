import { DragIndicator } from '@mui/icons-material';
import { Divider } from '@mui/material';
import { MutableRefObject, useEffect, useRef, useState } from 'react';

// some state to keep component width across route changes
const dividerState = new Map<string,number>();

/**
 * parentCmpRef is used optionally to keep width of parent stable, e.g. avoid resizing larger than parents width.
 * alternatively this can be configured by using maxWidth on cmp, but that doesnt always meet the requirements.
 */
function DraggableDivider(props: { cmpRef: MutableRefObject<HTMLDivElement | null>, isRightCmp: boolean, defaultCmpWidth: number, parentCmpRef?: MutableRefObject<HTMLDivElement | null>}) {

	const cmpWidth = useRef<number>(props.defaultCmpWidth);
	const parentCmpWidth = useRef<number>();
	const cmpMaxWidth = useRef<number>(); // detected cmp max width before parent begins to grow...
	const dragPos = useRef<[number, number]>();
	const dividerRef = useRef<HTMLHRElement>(null);

	useEffect(() => {
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", endDrag);
		return () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", endDrag);
		};
	});

    useEffect(() => {
		// initialise cmp with default width
        if (dividerRef.current && props.cmpRef.current) {
			props.cmpRef.current.style.width = (dividerState[dividerRef.current.nodeName] || cmpWidth)+'px';
		}
    }, []);

	function startDrag(pos: number) {
		if (props.cmpRef.current && dividerRef.current) {
			cmpWidth.current = props.cmpRef.current.offsetWidth;
			cmpMaxWidth.current = undefined;
			if (props.parentCmpRef) parentCmpWidth.current = props.parentCmpRef.current!.offsetWidth;
			dragPos.current = [pos, pos];
			dividerRef.current.style.backgroundColor = '#f0f0f0';
		}
	}

	function onMouseDown(ev: React.MouseEvent<HTMLElement>) {
		ev.preventDefault();
		startDrag(ev.clientX);
	}
	
	function onMouseMove(ev: MouseEvent) {
		updateDrag(ev.clientX);
	}

	function updateDrag(pos: number) {
		if (dragPos.current && props.cmpRef.current && cmpWidth) {
			dragPos.current = [dragPos.current[0], pos];
			const oldWidth = props.cmpRef.current.offsetWidth;
    		props.cmpRef.current.style.width = getCmpDraggedWidth()+'px';
			if (props.parentCmpRef && parentCmpWidth.current && parentCmpWidth.current < props.parentCmpRef.current!.offsetWidth) {
				console.log('drag width limit detected', oldWidth);
				cmpMaxWidth.current = oldWidth;
			}
		}
	}

	function endDrag() {
		if (dragPos.current && cmpWidth.current) {
			// save new width
			const newWidth = getCmpDraggedWidth();
			cmpWidth.current = newWidth;
            dividerState[dividerRef.current!.nodeName] = newWidth;
			// reset
			dragPos.current = undefined;
			if (dividerRef.current) dividerRef.current.style.backgroundColor = 'white';
		}
	}

	function getCmpDraggedWidth() {
		const draggedWidth = (dragPos.current ? (dragPos.current[1] - dragPos.current[0]) : 0);
		const newCmpWidth = cmpWidth.current! + (props.isRightCmp ? -draggedWidth : draggedWidth);
		return (cmpMaxWidth.current ? Math.min(cmpMaxWidth.current, newCmpWidth) : newCmpWidth);
	}

	return (
		<Divider orientation='vertical' ref={dividerRef} onMouseDown={onMouseDown} sx={{ width: 10, marginLeft: '5px', marginRight: '5px' }}>
			<DragIndicator sx={{ fontSize: 15, marginLeft: '-12px' }} />
		</Divider>
	)
}

export default DraggableDivider;