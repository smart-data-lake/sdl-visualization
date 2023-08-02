import { Sheet } from '@mui/joy';
import { useRef, useState } from 'react';
import { Route, Routes } from "react-router-dom";
import { useMemoWithDefault } from '../../hooks/useMemoWithDefault';
import DraggableDivider from '../../layouts/DraggableDivider';
import PageHeader from '../../layouts/PageHeader';
import { ConfigData, ConfigDataLists, InitialConfigDataLists } from '../../util/ConfigExplorer/ConfigData';
import './App.css';
import ElementDetails from './ElementDetails';
import ElementList from './ElementList';
import ElementTable from './ElementTable';
import GlobalConfigView from './GlobalConfigView';

interface SearchFilterDef {
	text: string;
	type: string;
}

function ConfigExplorer(props: { configData?: ConfigData }) {
	const { configData } = props;
	const [listWidth, setListWidth] = useState(250); // initial width of left element
	const listRef = useRef<HTMLDivElement>(null);
	const [filter, setFilter] = useState<SearchFilterDef>();

	const configDataLists = useMemoWithDefault(() => {
		if (configData) {
			return new InitialConfigDataLists(configData);
		} else {
			return new InitialConfigDataLists();
		}
	}, [configData], new InitialConfigDataLists());

	const filteredConfigDataLists: ConfigDataLists = useMemoWithDefault(() => {
		if (filter && filter.text && filter.text.length>0) {
			switch(filter.type) {
				case 'id': {
					return configDataLists.applyContainsFilter('id', filter.text);
				}
				case 'property': {
					const [prop,text] = filter.text.split(/[:=]/);
					return configDataLists.applyRegexFilter(prop, text);
				}
			}
		}
		// default is to return unfiltered lists
		return configDataLists;
	}, [filter, configData], configDataLists);

	return (
		<Sheet sx={{ display: 'flex', height: "100%", flexDirection: 'column' }}>
			<PageHeader title={'Configuration'} noBack={true} />
			<Sheet sx={{ display: 'flex', height: "calc(100% - 6.6rem)"}}>
				<ElementList configData={configData} configDataLists={filteredConfigDataLists!} width={listWidth} mainRef={listRef} setFilter={setFilter} />
				<DraggableDivider setWidth={setListWidth} cmpRef={listRef} isRightCmp={false} />
				<Routes>
					<Route path=":elementType" element={<ElementTable dataLists={filteredConfigDataLists!} />} />
					<Route path=":elementType/:elementName" element={<ElementDetails configData={configData} />} />
					<Route path="globalOptions" element={<GlobalConfigView data={configData?.global}/>} />
		  		</Routes>
			</Sheet>
		</Sheet>
	);
}

export default ConfigExplorer;
