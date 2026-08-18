import React from "react";
import { flowProps, GraphView, LayoutDirection } from "../util/ConfigExplorer/LineageTabUtils";

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

type LineageGraphContextType = {
  graphView: GraphView;
  setGraphView: (view: GraphView) => void;
  layout: LayoutDirection;
  setLayout: (layout: LayoutDirection) => void;
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
  selectedNodeAttributes: string[];
  setSelectedNodeAttributes: (attributes: string[]) => void;
};

export const nodeAttributes = [
  { label: "Action Execution Mode", value: "action-executionMode" },
  { label: "Data Partition State", value: "data-partitionState" },
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
  const [layout, setLayout] = React.useState<LayoutDirection>('TB');
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [selectedNodeAttributes, setSelectedNodeAttributes] = React.useState<string[]>(nodeAttributes.map(attr => attr.value));

  const panelContext = React.useMemo(() => ({
    lineageTabOpen, setLineageTabOpen, lineageTabProps, setLineageTabProps
  }), [lineageTabOpen, lineageTabProps]);

  const graphContext = React.useMemo(() => ({
    graphView, setGraphView, layout, setLayout, isExpanded, setIsExpanded, selectedNodeAttributes, setSelectedNodeAttributes
  }), [graphView, layout, isExpanded, selectedNodeAttributes]);

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
