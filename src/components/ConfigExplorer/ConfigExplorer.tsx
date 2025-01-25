import { Provider } from 'react-redux';

import { Box, Option, Select, Sheet, Typography } from '@mui/joy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel, PanelGroup } from "react-resizable-panels";
import { Route, Routes } from "react-router-dom";
import store from '../../app/store';
import { useFetchConfig, useFetchConfigVersions } from '../../hooks/useFetchData';
import { useUser } from '../../hooks/useUser';
import ErrorBoundary from '../../layouts/ErrorBoundary';
import PageHeader from '../../layouts/PageHeader';
import { ConfigDataLists, InitialConfigDataLists, emptyConfigDataLists } from '../../util/ConfigExplorer/ConfigData';
import CenteredCirularProgress from '../Common/CenteredCircularProgress';
import { PanelResizer } from '../Common/PanelResizer';
import './App.css';
import ElementDetails from './ElementDetails';
import ElementList from './ElementList';
import ElementTable from './ElementTable';
import GlobalConfigView from './GlobalConfigView';
import LineageTabSep from './LineageTab/LineageTabWithSeparateView';

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
      {data && data.length > 0 &&
        <Select size="sm" value={value} onChange={handleChange}>
          {data?.map((version, idx) => (
            <Option key={idx} value={version}>{version}</Option>
          ))}
        </Select>
      }
    </Box>
  );
}


function ConfigExplorer() {
  const userContext = useUser();
  const [version, setVersion] = useState<string|undefined>();
	const { data: configVersionData, isFetching: isFetchingConfigVersion } = useFetchConfigVersions(!userContext || userContext.authenticated);
	const { data: configData, isFetching: isFetchingConfig } = useFetchConfig(version, configVersionData?.length==0 || version!=undefined);
	const listRef = useRef<HTMLDivElement>(null);
	const parentRef = useRef<HTMLDivElement>(null);  
	const [filter, setFilter] = useState<SearchFilterDef>();
  const isFetching = isFetchingConfig || isFetchingConfigVersion;
	const [openLineage, setOpenLineage] = useState(false);

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
      />
			<Sheet sx={{ display: 'flex', width: '100%', flex: 1, minHeight: 0 }} ref={parentRef}>
			{!configData || isFetching ? (
          		<CenteredCirularProgress />
        	) : ( 
					<Provider store={store}>
            <PanelGroup direction="horizontal">
              <Panel defaultSize={15} minSize={8} collapsible={true}>
                <ElementList configData={configData} configDataLists={filteredConfigDataLists!} mainRef={listRef} setFilter={setFilter} />
              </Panel>
              <PanelResizer/>
              <Panel>
              <Routes>
                <Route path=":elementType" 
                  element={<ElementTable dataLists={filteredConfigDataLists!} />} 
                  errorElement={<ErrorBoundary/>}
                />
                <Route
                  path=":elementType/:elementName/:tab?"
                  element={<ElementDetails configData={configData} parentCmpRef={parentRef} version={version} openLineage={openLineage} setOpenLineage={setOpenLineage} />}
                  errorElement={<ErrorBoundary />}
                />
                <Route path="globalOptions" 
                  element={<GlobalConfigView data={configData?.global}/>} 
                  errorElement={<ErrorBoundary/>} 
                />
              </Routes>
              </Panel>
              {openLineage && <>
                <PanelResizer style={{marginLeft: "6px"}}/>
                <Panel minSize={7} collapsible={true}>
                  <Sheet sx={{ height: '100%', minWidth: '100px', marginLeft: "6px" }}>
                    <LineageTabSep />
                  </Sheet>
                </Panel>
                </>
              }
            </PanelGroup>
        </Provider>
       		 )}
			</Sheet>
		</Sheet>
	);
}

export default ConfigExplorer;
