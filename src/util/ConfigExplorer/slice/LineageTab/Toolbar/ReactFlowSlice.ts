import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../../../../app/store'
import { ReactFlowInstance, useReactFlow } from 'reactflow'
import { Node as GraphNode} from '../../../Graphs'
import { Node as ReactFlowNode, Edge as ReactFlowEdge} from 'reactflow'
import { resetGroupSettings } from '../../../LineageTabUtils'

interface ReactFlowState {
    rfi: ReactFlowInstance | undefined;
    reactFlowKey: number;
    groupedNodeComponents:  Map<string, GraphNode[]> | undefined;// store the connected components from group retrieved elements
    groupedNodeComponentsRf:  Map<string, ReactFlowNode[]> | undefined;// A map of the connected components to the current rfi
    selectedEdge: ReactFlowEdge | undefined;
}
const initialState: ReactFlowState = {
    rfi: undefined,
    reactFlowKey: 1,
    groupedNodeComponents: undefined,
    groupedNodeComponentsRf: undefined,
    selectedEdge: undefined
}

const ReactFlowSlice = createSlice({
    name: 'reactFlow',
    initialState,
    reducers: {
        setReactFlowInstance: (state, newState: PayloadAction<ReactFlowInstance>) => {
            state.rfi = newState.payload;
        },
        setGroupedComponents: (state, newState: PayloadAction<Map<string, GraphNode[]>>) => {
            state.groupedNodeComponents = newState.payload;
        },
        setGroupedComponentsRf: (state, newState: PayloadAction<Map<string, ReactFlowNode[]>>) => {
            state.groupedNodeComponentsRf = newState.payload;
        }, 
        setReactFlowKey: (state, newState: PayloadAction<number>) => {
            state.reactFlowKey = newState.payload;
        }, 
        setSelectedEdge: (state, newState: PayloadAction<ReactFlowEdge | undefined>) => {
            state.selectedEdge = newState.payload;
        }, 
    }
})

export const {setReactFlowInstance, 
              setGroupedComponents, 
              setGroupedComponentsRf, 
              setReactFlowKey, 
              setSelectedEdge,} = ReactFlowSlice.actions;
export const getRFI = (state: RootState) => state.reactFlow.rfi;
export const getReactFlowKey = (state: RootState) => state.reactFlow.reactFlowKey;
export const getGroupedComponents = (state: RootState) => state.reactFlow.groupedNodeComponents;
export const getGroupedComponentsRf = (state: RootState) => state.reactFlow.groupedNodeComponentsRf;
export const getSelectedEdge = (state: RootState) => state.reactFlow.selectedEdge;
export default ReactFlowSlice.reducer;