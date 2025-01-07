import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../../../../app/store'
import { ReactFlowInstance, useReactFlow } from 'reactflow'
import { Node as GraphNode } from '../../../Graphs'
import { Node as ReactFlowNode, Edge as ReactFlowEdge } from 'reactflow'
import { getPropertyByPath, } from '../../../../helpers'


interface propertySetterProps {
    path: string,
    value: any,
    nodeId?: string,
    fromOwnProps?: string,
    combine?: (arg1, arg2) => any
}

type GroupingRoutine = 'components' | 'subgroups';

interface ReactFlowState {
    rfi: ReactFlowInstance | undefined;
    groupedNodeComponents: Map<string, GraphNode[]> | undefined;// store the connected components from group retrieved elements
    groupedNodeComponentsRf: Map<string, ReactFlowNode[]> | undefined;// A map of the connected components to the current rfi
    subgroups: Map<string, GraphNode[]> | undefined;// store the subgroups from group retrieved elements
    subgroupsRf: Map<string, ReactFlowNode[]> | undefined;// A map of the subgroups to the current rfi
    selectedEdge: ReactFlowEdge | undefined;
    grouped: boolean;
    groupingRoutine: GroupingRoutine | undefined
}

const initialState: ReactFlowState = {
    rfi: undefined,
    groupedNodeComponents: undefined, 
    groupedNodeComponentsRf: undefined,
    subgroups: undefined,
    subgroupsRf: undefined,
    selectedEdge: undefined,
    grouped: false,
    groupingRoutine: undefined
}

const ReactFlowSlice = createSlice({
    name: 'reactFlow',
    initialState,
    reducers: {
        setRFI: (state, newState: PayloadAction<ReactFlowInstance>) => {
            state.rfi = newState.payload;
        },
        setGroupedComponents: (state, newState: PayloadAction<Map<string, GraphNode[]> | undefined>) => {
            state.groupedNodeComponents = newState.payload;
        },
        setGroupedComponentsRf: (state, newState: PayloadAction<Map<string, ReactFlowNode[]> | undefined>) => {
            state.groupedNodeComponentsRf = newState.payload;
        },
        setSubgroups: (state, newState: PayloadAction<Map<string, GraphNode[]> | undefined>) => {
            state.subgroups = newState.payload;
        },
        setSubgroupsRf: (state, newState: PayloadAction<Map<string, ReactFlowNode[]> | undefined>) => {
            state.subgroupsRf = newState.payload;
        },
        setSelectedEdge: (state, newState: PayloadAction<ReactFlowEdge | undefined>) => {
            state.selectedEdge = newState.payload;
        },
        setGrouped: (state, newState: PayloadAction<boolean>) => {
            state.grouped = newState.payload;
        },
        setGroupingRoutine: (state, newState: PayloadAction<GroupingRoutine | undefined>) => {
            state.groupingRoutine = newState.payload;
        },
        setRFINodeData: (state, newState: PayloadAction<propertySetterProps>) => {
            // mutate the props of a node in the rfi via an attribute path getter
            // from node.data.<path> and node.<fromOwnProps>
            const { value, path, nodeId, fromOwnProps, combine } = newState.payload;
            var node = state.rfi?.getNode(nodeId as string)!;
            const nodeIndex = state.rfi?.getNodes().findIndex(node => node.id === nodeId)!;
            var newNodes: ReactFlowNode[] = [...state.rfi?.getNodes()!];
            var newVal;

            if (fromOwnProps) {
                // node.<path> = combine(node.<fromOwnProps>, value)
                newVal = combine ? combine(getPropertyByPath(node, fromOwnProps), value) 
                                 : getPropertyByPath(node, fromOwnProps);
            } else {
                // node.<path> = value
                newVal = value;
            }

            // set nodes array and then set rfi prop
            node = {
                ...node,
                data: {
                    ...node.data,
                    [path]: newVal
                }
            };
            newNodes[nodeIndex] = node;
            state.rfi?.setNodes(newNodes);
        },
    }
})

export const {
    setRFI,
    setGroupedComponents,
    setGroupedComponentsRf,
    setSubgroups,
    setSubgroupsRf,
    setSelectedEdge,
    setRFINodeData,
    setGroupingRoutine } = ReactFlowSlice.actions;
export const getRFI = (state: RootState) => state.reactFlow.rfi;
export const getGroupedComponents = (state: RootState) => state.reactFlow.groupedNodeComponents;
export const getGroupedComponentsRf = (state: RootState) => state.reactFlow.groupedNodeComponentsRf;
export const getSubgroups = (state: RootState) => state.reactFlow.subgroups;
export const getSubgroupsRf = (state: RootState) => state.reactFlow.subgroupsRf;
export const getSelectedEdge = (state: RootState) => state.reactFlow.selectedEdge;
export const getGroupedState = (state: RootState) => state.reactFlow.grouped;
export const getGroupingRoutine = (state: RootState) => state.reactFlow.groupingRoutine;
export default ReactFlowSlice.reducer;