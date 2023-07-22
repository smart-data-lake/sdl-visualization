import { Sheet } from '@mui/joy';
import { useEffect, useRef, useState } from 'react';
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
	const [filter, setFilter] = useState<string>();
	const [allDataObjects, setAllDataObjects] = useState<string[]>([]);
	const [allActions, setAllActions] = useState<string[]>([]);
	const [allConnections, setAllConnections] = useState<string[]>([]);	
	const [currentDataObjects, setCurrentDataObjects] = useState(allDataObjects);
	const [currentActions, setCurrentActions] = useState<string[]>(allActions);
	const [currentConnections, setCurrentConnections] = useState<string[]>(allConnections);

	useEffect(() => {
		if (data) {
			if (data.dataObjects) {
				setAllDataObjects(Object.keys(data.dataObjects).sort());
			}
			if (data.actions) {
				setAllActions(Object.keys(data.actions).sort());
			}
			if (data.connections) {
				setAllConnections(Object.keys(data.connections).sort());
			}
		}
	}, [data]);

	useEffect(() => {
		if (filter && filter.length>0) {
			const searchText = filter.toLowerCase()
			setCurrentDataObjects(allDataObjects.filter(a => a.toLowerCase().includes(searchText)));
			setCurrentActions(allActions.filter(a => a.toLowerCase().includes(searchText)));
			setCurrentConnections(allConnections.filter(a => a.toLowerCase().includes(searchText)));
		} else {
			setCurrentDataObjects(allDataObjects);
			setCurrentActions(allActions);
			setCurrentConnections(allConnections);
		}
	}, [filter, allDataObjects, allActions, allConnections]);


	return (
		<Sheet sx={{ display: 'flex', height: "100%", flexDirection: 'column' }}>
			<PageHeader title={'Configuration'} noBack={true} />
			<Sheet sx={{ display: 'flex', height: "calc(100% - 6.6rem)"}}>
				<ElementList dataObjects={currentDataObjects} actions={currentActions} connections={currentConnections} width={listWidth} mainRef={listRef} filter={filter} setFilter={setFilter} />
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
