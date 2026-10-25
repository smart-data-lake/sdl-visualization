import { Box, Option, Select, Sheet, Typography } from '@mui/joy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel, PanelGroup } from "react-resizable-panels";
import { Route, Routes } from "react-router-dom";
import { useFetchConfig, useFetchConfigVersions } from '../../hooks/useFetchData';
import { useConfigVersion } from '../../hooks/useConfigVersion';
import { useWorkspace } from '../../hooks/useWorkspace';
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
import { useLineagePanel } from '../../hooks/useLineage';

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

// the REST backends have no unversioned configuration, so an environment without versions has none
function NoConfiguration() {
  const { repo, env } = useWorkspace();
  const scope = repo && env ? ` for repository ${repo} and environment ${env}` : '';
  return (
    <Box sx={{display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center'}}>
      <Sheet variant='soft' color='neutral' sx={{p: '2rem', borderRadius: '0.5rem', maxWidth: '40rem', textAlign: 'center'}}>
        <Typography level='title-lg' sx={{mb: 1}}>No configuration yet</Typography>
        <Typography level='body-md'>
          No SDLB configuration has been uploaded{scope}. It appears here once an SDLB job has exported its configuration.
        </Typography>
      </Sheet>
    </Box>
  );
}

function ConfigExplorer() {
  const userContext = useUser();
  // in a context, so the global search in the title bar looks at the same version
  const { version, setVersion } = useConfigVersion();
	const { data: configVersionData, isFetching: isFetchingConfigVersion } = useFetchConfigVersions(!userContext || userContext.authenticated);
	const { data: configData, isFetching: isFetchingConfig, isFetched: isFetchedConfig } = useFetchConfig(version, configVersionData?.length==0 || version!=undefined);
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

  const { lineageTabOpen } = useLineagePanel();

	return (
		<Sheet sx={{ display: 'flex', flexDirection: 'column', p: '0.1rem 1rem', gap: '1rem', width: '100%', height: '100%' }}>
     	<PageHeader
        title={<ConfigVersionSelector data={configVersionData} value={version} setValue={setVersion} />}
      />
			<Sheet sx={{ display: 'flex', width: '100%', flex: 1, minHeight: 0 }} ref={parentRef}>
			{isFetching || (!configData && !isFetchedConfig) ? (
          		<CenteredCirularProgress />
        	) : !configData ? (
          <NoConfiguration/>
        	) : ( 
          <PanelGroup direction="horizontal">
            <Panel defaultSize={15} minSize={8} collapsible={true}>
              <ElementList configData={configData} configDataLists={filteredConfigDataLists!} mainRef={listRef} setFilter={setFilter} />
            </Panel>
            <PanelResizer/>
            <Panel>
            <Routes>
              <Route path=":elementType" 
                element={<ElementTable dataLists={filteredConfigDataLists!} configData={configData} />} 
                errorElement={<ErrorBoundary/>}
              />
              <Route
                path=":elementType/:elementName/:tab?"
                element={<ElementDetails configData={configData} parentCmpRef={parentRef} version={version} />}
                errorElement={<ErrorBoundary />}
              />
              <Route path="globalOptions" 
                element={<GlobalConfigView data={configData?.global}/>} 
                errorElement={<ErrorBoundary/>} 
              />
            </Routes>
            </Panel>
            {lineageTabOpen && <>
              <PanelResizer style={{marginLeft: "6px"}}/>
              <Panel minSize={7} collapsible={true}>
                <Sheet sx={{ height: '100%', minWidth: '100px', marginLeft: "6px" }}>
                  <LineageTabSep />
                </Sheet>
              </Panel>
              </>
            }
          </PanelGroup>
          )}
			</Sheet>
		</Sheet>
	);
}

export default ConfigExplorer;
