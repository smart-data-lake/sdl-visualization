import { Sheet } from '@mui/joy';
import { useRef, useState } from 'react';
import { Route, Routes } from "react-router-dom";
import PageHeader from '../../layouts/PageHeader';
import './App.css';
import ElementList from './ElementList';
import DraggableDivider from '../../layouts/DraggableDivider';
import SearchResults from './SearchResults';
import ElementDetails from './ElementDetails';
import GlobalConfigView from './GlobalConfigView';
import { ConfigData, ConfigDataLists, InitialConfigDataLists } from '../../util/ConfigExplorer/ConfigData';
import ElementTable from './ElementTable';
import { useMemoWithDefault } from '../../hooks/useMemoWithDefault';


function ConfigExplorer(props: { configData?: ConfigData }) {
	const { configData } = props;
	const [listWidth, setListWidth] = useState(250); // initial width of left element
	const listRef = useRef<HTMLDivElement>(null);
	const [filter, setFilter] = useState<string>();

	const configDataLists = useMemoWithDefault(() => {
		if (configData) {
			return new InitialConfigDataLists(configData);
		} else {
			return new InitialConfigDataLists();
		}
	}, [configData], new InitialConfigDataLists());

	const filteredConfigDataLists: ConfigDataLists = useMemoWithDefault(() => {
		if (filter && filter.length>0) {
			return configDataLists.applySimpleFilter(filter);
		}
		return configDataLists;
	}, [filter, configData], configDataLists);

	return (
		<Sheet sx={{ display: 'flex', height: "100%", flexDirection: 'column' }}>
			<PageHeader title={'Configuration'} noBack={true} />
			<Sheet sx={{ display: 'flex', height: "calc(100% - 6.6rem)"}}>
				<ElementList configData={configData} configDataLists={filteredConfigDataLists!} width={listWidth} mainRef={listRef} setFilter={setFilter} />
				<DraggableDivider setWidth={setListWidth} cmpRef={listRef} isRightCmp={false} />
				<Routes>
					<Route path='search/:ownSearchString' element={<SearchResults data={configData}/>} /> //the ownSearchString is our definition of a search because of problems with routing Search Parameters
					<Route path=":elementType" element={<ElementTable dataLists={filteredConfigDataLists!} />} />
					<Route path=":elementType/:elementName" element={<ElementDetails configData={configData} />} />
					<Route path="globalOptions" element={<GlobalConfigView data={configData?.global}/>} />
		  		</Routes>
			</Sheet>
		</Sheet>
	);
}

export default ConfigExplorer;
