import { Sheet } from '@mui/joy';
import { useRef, useState } from 'react';
import { Route, Routes } from "react-router-dom";
import PageHeader from '../../layouts/PageHeader';
import './App.css';
import ElementList from './ElementList';
import DraggableDivider from '../../layouts/DraggableDivider';
import SearchResults from './SearchResults';
import DataDisplayView from './DataDisplayView';
import GlobalConfigView from './GlobalConfigView';


function ConfigExplorer(props: { data: any }) {
	const { data } = props;
	const [listWidth, setListWidth] = useState(250); // initial width of left element
	const listRef = useRef<HTMLDivElement>(null);

	return (
		<Sheet sx={{ display: 'flex', height: "100%", flexDirection: 'column' }}>
			<PageHeader title={'Configuration'} noBack={true} />
			<Sheet sx={{ display: 'flex', height: "calc(100% - 6.6rem)"}}>
				<ElementList data={data} width={listWidth} mainRef={listRef} />
				<DraggableDivider setWidth={setListWidth} cmpRef={listRef} isRightCmp={false} />
				<Routes>
					<Route path='search/:ownSearchString' element={<SearchResults data={data}/>} /> //the ownSearchString is our definition of a search because of problems with routing Search Parameters
					<Route path=":elementType/:elementName" element={<DataDisplayView data={data} />} />
					<Route path="globalOptions" element={<GlobalConfigView data={data?.global}/>} />
		  		</Routes>
			</Sheet>
		</Sheet>
	);
}

export default ConfigExplorer;
