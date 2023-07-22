import { Sheet } from '@mui/joy';
import { useRef, useState } from 'react';
import { Outlet } from "react-router-dom";
import PageHeader from '../../layouts/PageHeader';
import './App.css';
import ElementList from './ElementList';
import DraggableDivider from '../../layouts/DraggableDivider';


function ConfigExplorer(props: { data: any }) {
	const { data } = props;
	const [listWidth, setListWidth] = useState(150); // initial width of left element
	const listRef = useRef<HTMLDivElement>(null);

	return (
		<Sheet sx={{ display: 'flex', height: "100%", flexDirection: 'column' }}>
			<PageHeader title={'Configuration'} noBack={true} />
			<Sheet sx={{ display: 'flex', height: "calc(100% - 6.6rem)"}}>
				<ElementList data={data} width={listWidth} mainRef={listRef} />
				<DraggableDivider setWidth={setListWidth} cmpRef={listRef} isRightCmp={false} />
				<Outlet />
			</Sheet>
		</Sheet>
	);
}

export default ConfigExplorer;
