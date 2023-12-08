import { useQuery } from "react-query";
import { getConfiguredFetcher } from "../api/Fetcher";
import { fetchAPI } from "../api/fetchAPI";
import { getUrlContent } from "../util/ConfigExplorer/HoconParser";
import { formatFileSize } from "../util/helpers";


// lazy initialized
var _fetcher: fetchAPI;
function fetcher() {
  if (!_fetcher) _fetcher = getConfiguredFetcher();
  return _fetcher;
}

/**
 * React Query wrapper for fetching data
 **/


/**** Workflows  ****/
export const useFetchWorkflows = () => {
  return useQuery({ queryKey: 'workflows', queryFn: () => fetcher().getWorkflows(), retry: false, staleTime: 1000 * 60 * 60 * 24 }) //24h
}
export const useFetchWorkflowRuns = (workflow: string) => {
  return useQuery({ queryKey: ['workflowRun', workflow], queryFn: () => fetcher().getWorkflowRuns(workflow), retry: false, staleTime: 1000 * 60 * 60 * 24 }) //24h
}
export const useFetchWorkflowRunsByElement = (elementType: string, elementName: string) => {
  var queryFn = () => Promise.resolve(undefined as any[]|undefined);
  if (elementType === "dataObjects") queryFn = () => fetcher().getWorkflowRunsByDataObject(elementName)
  if (elementType === "actions") queryFn = () => fetcher().getWorkflowRunsByAction(elementName)
  return useQuery({ queryKey: ['workflowRunByAction', elementType, elementName], queryFn: queryFn, retry: false, staleTime: 1000 * 60 * 60 * 24 }) //24h
}
export const useFetchRun = (name: string, runId: number, attemptId: number) => {
  return useQuery({ queryKey: ['run', name, runId, attemptId], queryFn: () => fetcher().getRun({ name, runId, attemptId }), retry: false, staleTime: 1000 * 60 * 60 * 24 }) //24h
}

/**** index files  ****/
export interface TsIndexEntry {
  filename: string;
  ts: Date;
}
function getTsFromIndexFilename(statsFile: string): Date {
  const matches = statsFile.match(/\.([0-9]+)\./);
  if (!matches || matches.length < 2) throw new Error("Cannot parse timestamp from filename "+statsFile)
  return new Date(parseInt(matches[1]) * 1000);
}
function getTsIndex(type: string, subtype: string, elementName: string): Promise<TsIndexEntry[] | undefined> {
	const filename = `/${type}/${elementName}.${subtype}.index`;
	return getUrlContent(filename)
	.then((content: string) => 
    content.split(/\r?\n/)
    .filter((e) => e.length > 0)
    .map((e) => {return {filename: e, ts: getTsFromIndexFilename(e)}})
    .reverse()
  )
	.catch((error) => {console.log(error); return undefined});
}


/**** DataObject schema index  ****/
function getSchemaIndex(elementType: string|undefined, elementName: string|undefined): Promise<TsIndexEntry[] | undefined> {
	if (elementType != 'dataObjects' || !elementType || !elementName) return Promise.resolve(undefined); // Schemas only exists for data objects
  return getTsIndex('schema', 'schema', elementName);
}
export const useFetchDataObjectSchemaIndex = (elementType: string|undefined, elementName: string|undefined) => {
  return useQuery({ queryKey: ['schemaIndex', elementType, elementName], queryFn: () => getSchemaIndex(elementType, elementName), retry: false, staleTime: 1000 * 60 * 60 * 24 }) //24h
}

/**** DataObject schema data ****/
export interface SchemaColumn {
  name : string;
  dataType: string|SchemaArrayType|SchemaStructType;
  nullable?: boolean;
}
export interface SchemaArrayType {
  dataType: 'array';
  elementType: string|SchemaArrayType|SchemaStructType;
}
export interface SchemaStructType {
  dataType: 'struct';
  fields: SchemaColumn[];
}
export interface SchemaData{
  info?: string;
  schema?: SchemaColumn[];
}
function getSchema(schemaFile: string | undefined): Promise<SchemaData | undefined> {
  if (!schemaFile) return Promise.resolve(undefined);
	const filename = "/schema/"+ schemaFile; //file must be in public/schema folder
	return getUrlContent(filename)
  .then((str) => JSON.parse(str) as SchemaData)
	.catch((error) => {console.log(error); return undefined})
}
export const useFetchDataObjectSchema = (schemaEntry: TsIndexEntry|undefined) => {
  return useQuery({ queryKey: ['schema',schemaEntry?.filename], queryFn: () => getSchema(schemaEntry?.filename), retry: false, staleTime: 1000 * 60 * 60 * 24 }) //24h
}

/**** DataObject statistics index  ****/
function getStatsIndex(elementType: string|undefined, elementName: string|undefined): Promise<TsIndexEntry[] | undefined> {
	if (elementType != 'dataObjects' || !elementType || !elementName) return Promise.resolve(undefined); // Statistics only exists for data objects
  return getTsIndex('schema', 'stats', elementName);
}
export const useFetchDataObjectStatsIndex = (elementType: string|undefined, elementName: string|undefined) => {
  return useQuery({ queryKey: ['statsIndex', elementType, elementName], queryFn: () => getStatsIndex(elementType, elementName), retry: false, staleTime: 1000 * 60 * 60 * 24 }) //24h
}

/**** DataObject statistics data  ****/
export interface Stats {
  numFiles? : number;
  numRows? : number;
  numPartitions? : number;
  tableSizeInBytes?: string;
  columns?: {};
  sizeInBytes?: string;
  createdAt?: Date;
  lastModifiedAt?: Date;
}
function getStats(statsFile: string | undefined): Promise<Stats | undefined> {
  if (!statsFile) return Promise.resolve(undefined);
	const filename = "/schema/"+ statsFile; //file must be in public/schema folder
	return getUrlContent(filename)
  .then((str) => {
    const obj = JSON.parse(str)
    Object.keys(obj).forEach((key) => {
      if (key.endsWith("At") && typeof obj[key] === "number") obj[key] = new Date(obj[key]);
      if (key.endsWith("InBytes") && typeof obj[key] === "number") obj[key] = formatFileSize(obj[key]!);
    })
    return obj as Stats;
  })
	.catch((error) => {console.log(error); return undefined})
}
export const useFetchDataObjectStats = (statsEntry: TsIndexEntry|undefined) => {
  return useQuery({ queryKey: ['stats',statsEntry?.filename], queryFn: () => getStats(statsEntry?.filename), retry: false, staleTime: 1000 * 60 * 60 * 24 }) //24h
}

/**** Element description markdown files ****/
function getDescription(elementType: string, elementName: string) {
	const filename = "/description/" + elementType + "/" + elementName +".md"; //file must be in public/description/elementType folder
	return getUrlContent(filename)
	.catch((error) => console.log(error))
}
export const useFetchDescription = (elementType: string|undefined, elementName: string|undefined) => {
  return useQuery({ queryKey: ['description',elementType,elementName], queryFn: () => getDescription(elementType!, elementName!), retry: false, staleTime: 1000 * 60 * 60 * 24 }) //24h
}

export default useFetchWorkflows;