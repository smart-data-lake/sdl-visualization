import React from "react";
import { flowProps, GraphView, LayoutDirection } from "../util/ConfigExplorer/LineageTabUtils";
import type { LayoutMode } from "../util/ConfigExplorer/LineageLayout";
import type { ColumnRef } from "../util/ConfigExplorer/columnLineage";
import type { Grouping } from "../util/ConfigExplorer/Grouping";
import { useManifest } from "./useManifest";

/*
  State of the lineage graph in the config explorer.

  This is split into two contexts on purpose:
  - the panel context holds what the surrounding config explorer needs to know (is the panel open,
    which element is it showing). It changes on navigation only.
  - the graph context holds the toolbar settings, which change on every toolbar click and are only
    consumed by components inside the lineage panel.
  Keeping them apart avoids re-rendering the whole config explorer (element list, tables, details)
  whenever a toolbar button is pressed.

  Unlike the other contexts in this folder the values are memoized, because they are consumed by
  every node of the lineage graph.
*/

type LineagePanelContextType = {
  lineageTabOpen: boolean;
  setLineageTabOpen: (open: boolean) => void;
  lineageTabProps: flowProps;
  setLineageTabProps: (props: flowProps) => void;
};

/** what the layout menu offers: a layered layout in either direction, or a force directed one */
export type LayoutChoice = LayoutDirection | 'force';

/** the layout a view is shown in */
export interface ViewLayout {
  choice: LayoutChoice;
  /** the direction handles and ranks follow; a force layout keeps the relation handles' left to right */
  direction: LayoutDirection;
  mode: LayoutMode;
}

export function viewLayoutOf(choice: LayoutChoice): ViewLayout {
  return {choice, direction: choice === 'force' ? 'LR' : choice, mode: choice === 'force' ? 'force' : 'layered'};
}

type LineageGraphContextType = {
  graphView: GraphView;
  setGraphView: (view: GraphView) => void;
  /** the relations view keeps a layout of its own, force directed until another is chosen; the flows share one */
  layoutOf: (view: GraphView) => ViewLayout;
  setLayout: (view: GraphView, layout: LayoutChoice) => void;
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
  selectedNodeAttributes: string[];
  setSelectedNodeAttributes: (attributes: string[]) => void;
  /** the column whose dependencies and impact are highlighted, see traceHighlights */
  tracedColumn: ColumnRef | undefined;
  setTracedColumn: (column: ColumnRef | undefined) => void;
  /** the attributes the nodes are boxed by, along and across the flow, see Grouping.ts */
  grouping: Grouping;
  setGrouping: (grouping: Grouping) => void;
};

export const nodeAttributes = [
  { label: "Execution Mode", value: "action-executionMode" },
  { label: "Partitioned", value: "data-partitionState" },
];

const emptyLineageTabProps: flowProps = {
  elementName: '',
  elementType: '',
  configData: undefined,
  runContext: undefined
};

const LineagePanelContext = React.createContext<LineagePanelContextType | undefined>(undefined);
LineagePanelContext.displayName = "LineagePanelContext";

const LineageGraphContext = React.createContext<LineageGraphContextType | undefined>(undefined);
LineageGraphContext.displayName = "LineageGraphContext";

const LineageProvider = (props: React.PropsWithChildren) => {
  const [lineageTabOpen, setLineageTabOpen] = React.useState(false);
  const [lineageTabProps, setLineageTabProps] = React.useState<flowProps>(emptyLineageTabProps);
  const [graphView, setGraphView] = React.useState<GraphView>('full');
  // the manifest's layout applies until the user picks one
  const { data: manifest } = useManifest();
  const [chosenFlowLayout, setFlowLayout] = React.useState<LayoutDirection>();
  const [relationsLayout, setRelationsLayout] = React.useState<LayoutChoice>('force');
  const flowLayout: LayoutDirection = chosenFlowLayout ?? (manifest?.lineageLayout === 'TB' ? 'TB' : 'LR');
  const layoutOf = React.useCallback((view: GraphView) => viewLayoutOf(view === 'relations' ? relationsLayout : flowLayout),
    [relationsLayout, flowLayout]);
  const setLayout = React.useCallback((view: GraphView, choice: LayoutChoice) => {
    if (view === 'relations') setRelationsLayout(choice);
    else if (choice !== 'force') setFlowLayout(choice); // only the relations view offers a force layout
  }, []);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [selectedNodeAttributes, setSelectedNodeAttributes] = React.useState<string[]>(nodeAttributes.map(attr => attr.value));
  const [tracedColumn, setTracedColumn] = React.useState<ColumnRef | undefined>(undefined);
  const [grouping, setGrouping] = React.useState<Grouping>({});

  const panelContext = React.useMemo(() => ({
    lineageTabOpen, setLineageTabOpen, lineageTabProps, setLineageTabProps
  }), [lineageTabOpen, lineageTabProps]);

  const graphContext = React.useMemo(() => ({
    graphView, setGraphView, layoutOf, setLayout, isExpanded, setIsExpanded, selectedNodeAttributes, setSelectedNodeAttributes,
    tracedColumn, setTracedColumn, grouping, setGrouping,
  }), [graphView, layoutOf, isExpanded, selectedNodeAttributes, tracedColumn, grouping]);

  return (
    <LineagePanelContext.Provider value={panelContext}>
      <LineageGraphContext.Provider value={graphContext}>
        {props.children}
      </LineageGraphContext.Provider>
    </LineagePanelContext.Provider>
  );
};

const useLineagePanel = (): LineagePanelContextType => {
  const context = React.useContext(LineagePanelContext);
  if (context === undefined) {
    throw new Error("useLineagePanel must be used within a LineageProvider");
  }
  return context;
};

const useLineageGraph = (): LineageGraphContextType => {
  const context = React.useContext(LineageGraphContext);
  if (context === undefined) {
    throw new Error("useLineageGraph must be used within a LineageProvider");
  }
  return context;
};

export { LineageProvider, useLineageGraph, useLineagePanel };
