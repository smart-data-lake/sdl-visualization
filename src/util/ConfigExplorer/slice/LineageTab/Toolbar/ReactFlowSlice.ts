import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../../../../app/store'
import { ReactFlowInstance, useReactFlow } from 'reactflow'
import { Node as GraphNode} from '../../../Graphs'
import { Node as ReactFlowNode} from 'reactflow'

interface ReactFlowState {
    rfi: ReactFlowInstance | undefined;
    groupedNodeComponents:  Map<string, GraphNode[]> | undefined;// store the connected components from group retrieved elements
    groupedNodeComponentsRf:  Map<string, ReactFlowNode[]> | undefined;// A map of the connected components to the current rfi
}
const initialState: ReactFlowState = {
    rfi: useReactFlow(),
    groupedNodeComponents: undefined,
    groupedNodeComponentsRf: undefined
}

const ReactFlowSlice = createSlice({
    name: 'reactFlow',
    initialState,
    reducers: {
        setReactFlowInstanceTo: (state, newState: PayloadAction<ReactFlowInstance>) => {
            state.rfi = newState.payload;
        },
        setGroupedComponentsTo: (state, newState: PayloadAction<Map<string, GraphNode[]>>) => {
            state.groupedNodeComponents = newState.payload;
        },
        setGroupedComponentsRfTo: (state, newState: PayloadAction<Map<string, ReactFlowNode[]>>) => {
            state.groupedNodeComponentsRf = newState.payload;
        }
    }
})

export const {setReactFlowInstanceTo, setGroupedComponentsTo, setGroupedComponentsRfTo} = ReactFlowSlice.actions;
export const getRFI = (state: RootState) => state.reactFlow.rfi;
export default ReactFlowSlice.reducer;