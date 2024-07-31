import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../../../../app/store'
import { DAGraph, Node as GraphNode } from '../../../Graphs'
import { ReactFlowInstance } from 'reactflow'

// overlaps with reactflowSlice... is this necessary?
interface GroupingState {
    grouped: boolean,
    groupingFunc:  ((rfi: ReactFlowInstance, G: DAGraph, args: any) => void) | undefined,
    groupingArgs: any
}
const initialState: GroupingState = {
    grouped: false,
    groupingFunc: undefined,
    groupingArgs: undefined
}

const GroupingSlice = createSlice({
    name: 'grouper',
    initialState,
    reducers: {
        setGroupingState: (state, newState: PayloadAction<boolean>) => {
            state.grouped = newState.payload;
        }
    }
})

export const {setGroupingState} = GroupingSlice.actions;
export const getGroupingState = (state: RootState) => state.grouper.grouped;
export const getGroupingFunc = (state: RootState) => state.grouper.groupingFunc;
export const getGroupingArgs = (state: RootState) => state.grouper.groupingArgs;
export default GroupingSlice.reducer;