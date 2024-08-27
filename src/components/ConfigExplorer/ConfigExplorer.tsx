import { Provider } from 'react-redux';

import { CircularProgress, Select, Sheet, Typography, Option, Box  } from '@mui/joy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Route, Routes } from "react-router-dom";
import store from '../../app/store';
import DraggableDivider from '../../layouts/DraggableDivider';
import ErrorBoundary from '../../layouts/ErrorBoundary';
import PageHeader from '../../layouts/PageHeader';
import { ConfigDataLists, InitialConfigDataLists, emptyConfigDataLists } from '../../util/ConfigExplorer/ConfigData';
import CenteredCirularProgress from '../Common/CenteredCircularProgress';
import './App.css';
import ElementDetails from './ElementDetails';
import ElementList from './ElementList';
import ElementTable from './ElementTable';
import GlobalConfigView from './GlobalConfigView';
import { useFetchConfig, useFetchConfigVersions } from '../../hooks/useFetchData';

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

function ConfigVersionSelector({
  data,
  value,
  setValue,
}: {
  data: string[] | undefined;
  value: string | undefined;
  setValue: (value: string) => void;
}) {
  useEffect(() => {
    if (!value && data && data.length > 0) {
      setValue(data[0]);
    }
  }, [value, data, setValue]);

  const handleChange = useCallback(
    (_: React.SyntheticEvent | null, newValue: string | null) => {
      setValue(newValue ?? "");
    },
    [setValue]
  );

  return (
    <Box sx={{ display: "flex", gap: "1rem" }}>
      <Typography level="h4">Configuration</Typography>
      {data && 
        <Select size="sm" value={value} onChange={handleChange}>
          {data?.map((version) => (
            <Option value={version}>{version}</Option>
          ))}
        </Select>
      }
    </Box>
  );
}

function ConfigExplorer() {
	const [version, setVersion] = useState<string|undefined>();
	const { data: configVersionData, isFetching: isFetchingConfigVersion } = useFetchConfigVersions();
	const { data: configData, isFetching: isFetchingConfig } = useFetchConfig(version, isFetchingConfigVersion && (configVersionData==undefined || version!=undefined));
	const listRef = useRef<HTMLDivElement>(null);
	const parentRef = useRef<HTMLDivElement>(null);  
	const [filter, setFilter] = useState<SearchFilterDef>();
  const isFetching = isFetchingConfig || isFetchingConfigVersion;

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
		<Sheet sx={{ display: 'flex', flexDirection: 'column', p: '0.1rem 1rem', gap: '1rem', width: '100%', height: '100%' }}>
     	<PageHeader
        title={<ConfigVersionSelector data={configVersionData} value={version} setValue={setVersion} />}
        noBack={true}
      />
			<Sheet sx={{ display: 'flex', width: '100%', flex: 1, minHeight: 0 }} ref={parentRef}>
			{!configData || isFetching ? (
          		<CenteredCirularProgress />
        	) : ( 
					<Provider store={store}>
						<ElementList configData={configData} configDataLists={filteredConfigDataLists!} mainRef={listRef} setFilter={setFilter} />
						<DraggableDivider id="config-elementlist" cmpRef={listRef} isRightCmp={false} defaultCmpWidth={250} parentCmpRef={parentRef} />
						<Routes>
							<Route path=":elementType" element={<ElementTable dataLists={filteredConfigDataLists!} />} errorElement={<ErrorBoundary/>} />
							<Route path=":elementType/:elementName/:tab?" element={<ElementDetails configData={configData} parentCmpRef={parentRef} />} errorElement={<ErrorBoundary/>} />
							<Route path="globalOptions" element={<GlobalConfigView data={configData?.global}/>} errorElement={<ErrorBoundary/>} />
						</Routes>
					</Provider>
       		 )}
			</Sheet>
		</Sheet>
	);
}

export default ConfigExplorer;
