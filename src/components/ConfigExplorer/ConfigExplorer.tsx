import { Sheet } from '@mui/joy';
import { useMemo, useRef, useState } from 'react';
import { Route, Routes } from "react-router-dom";
import DraggableDivider from '../../layouts/DraggableDivider';
import PageHeader from '../../layouts/PageHeader';
import { ConfigData, ConfigDataLists, InitialConfigDataLists, emptyConfigDataLists } from '../../util/ConfigExplorer/ConfigData';
import './App.css';
import ElementDetails from './ElementDetails';
import ElementList from './ElementList';
import ElementTable from './ElementTable';
import GlobalConfigView from './GlobalConfigView';
import ErrorBoundary from '../../layouts/ErrorBoundary';


interface SearchFilterDef {
	text: string;
	type: string;
}

export function applyFilter(configDataLists: InitialConfigDataLists, filter: SearchFilterDef): ConfigDataLists {
    switch(filter.type) {
        case 'id': {
            return configDataLists.applyContainsFilter('id', filter.text);
        }
        case 'property': {
            const [prop,text] = filter.text.split(/[:=]/);
            return configDataLists.applyRegexFilter(prop, text);
        }
        case 'feedSel': {
            return configDataLists.applyFeedFilter(filter.text);
        }		
		default: throw Error(`Unknown search type ${filter.type}`);
    }	
}

function ConfigExplorer(props: { configData?: ConfigData }) {
	const { configData } = props;
	const listRef = useRef<HTMLDivElement>(null);
	const parentRef = useRef<HTMLDivElement>(null);  
	const [filter, setFilter] = useState<SearchFilterDef>();

	const configDataLists = useMemo(() => {
		if (configData) {
			return new InitialConfigDataLists(configData);
		} else {
			return emptyConfigDataLists;
		}
	}, [configData]);

	const filteredConfigDataLists: ConfigDataLists = useMemo(() => {
		if (filter && filter.text && filter.text.length>0) {
			return applyFilter(configDataLists, filter);
		}
		// default is to return unfiltered lists
		return configDataLists;
	}, [filter, configDataLists]);

	return (
		<Sheet sx={{ display: 'flex', width: '100%', height: '100%', p: '0.1rem 1rem', flexDirection: 'column' }}>
			<PageHeader title={'Configuration'} noBack={true} />
			<Sheet sx={{ display: 'flex', width: '100%', flex: 1, minHeight: 0 }} ref={parentRef}>
				<ElementList configData={configData} configDataLists={filteredConfigDataLists!} mainRef={listRef} setFilter={setFilter} />
				<DraggableDivider id="config-elementlist" cmpRef={listRef} isRightCmp={false} defaultCmpWidth={250} parentCmpRef={parentRef} />
				<Routes>
					<Route path=":elementType" element={<ElementTable dataLists={filteredConfigDataLists!} />} errorElement={<ErrorBoundary/>} />
					<Route path=":elementType/:elementName/:tab?" element={<ElementDetails configData={configData} parentCmpRef={parentRef} />} errorElement={<ErrorBoundary/>} />
					<Route path="globalOptions" element={<GlobalConfigView data={configData?.global}/>} errorElement={<ErrorBoundary/>} />
				</Routes>
			</Sheet>
		</Sheet>
	);
}

export default ConfigExplorer;
