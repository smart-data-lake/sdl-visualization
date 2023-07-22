import { DragIndicator } from '@mui/icons-material';
import { Divider } from '@mui/material';
import { MutableRefObject, useEffect, useRef } from 'react';

// some state to keep left component width accross path changes
const dividerState = new Map<string,number>();

function DraggableDivider(props: { setWidth: (number) => void, cmpRef: MutableRefObject<HTMLDivElement | null>, isRightCmp: boolean}) {

	const leftWidth = useRef<number>();
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
        // initialize left componentent width
        if (dividerRef.current && dividerState[dividerRef.current.nodeName]) {
            props.setWidth(dividerState[dividerRef.current.nodeName]);
        }
    });

	function startDrag(pos: number) {
		if (props.cmpRef.current && dividerRef.current) {
			leftWidth.current = props.cmpRef.current.clientWidth;
			dragPos.current = [pos, pos];
			dividerRef.current.style.backgroundColor = '#f0f0f0';
		}
	}

	function onMouseDown(ev: React.MouseEvent<HTMLElement>) {
		startDrag(ev.clientX);
	}
	
	function onMouseMove(ev: MouseEvent) {
		updateDrag(ev.clientX);
	}

	function updateDrag(pos: number) {
		if (dragPos.current && props.cmpRef.current) {
			dragPos.current = [dragPos.current[0], pos];
    		props.cmpRef.current.style.width = `${getLeftDraggedWidth()}px`;
		}
	}

	function endDrag() {
		if (dragPos.current) {
            const width = getLeftDraggedWidth()
			props.setWidth(width);
            dividerState[dividerRef.current!.nodeName] = width;
			dragPos.current = undefined;
			if (dividerRef.current) dividerRef.current.style.backgroundColor = 'white';
		}
	}

	function getLeftDraggedWidth() {
		const sideMultpl = (props.isRightCmp ? -1 : 1);
		return leftWidth.current! + (dragPos.current ? (dragPos.current[1] - dragPos.current[0]) : 0) * sideMultpl;
	}

	return (
		<Divider orientation='vertical' ref={dividerRef} onMouseDown={onMouseDown} sx={{ width: 10, marginLeft: '5px', marginRight: '5px' }}>
			<DragIndicator sx={{ fontSize: 15, marginLeft: '-12px' }} />
		</Divider>
	)
}

export default DraggableDivider;