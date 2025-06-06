import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../../../../app/store'

export const nodeAttributes = [
    { label: "Action Execution Mode", value: "actionExecutionMode" },
    { label: "Data Partition State", value: "dataPartitionState" },
];

interface nodeAttributeFilterState {
    selectedAttributes: string[],
}

const initialState: nodeAttributeFilterState = {
    selectedAttributes: nodeAttributes.map(attr => attr.value),
}

const nodeAttributeFilterSlice = createSlice({
    name: 'nodeAttributeFilter',
    initialState,
    reducers: {
        setSelectedNodeAttributes: (state, newState: PayloadAction<string[]>) => {
            state.selectedAttributes = newState.payload;
        }
    }
})

export const {setSelectedNodeAttributes} = nodeAttributeFilterSlice.actions;
export const getSelectedNodeAttributes = (state: RootState) => state.nodeAttributeFilter.selectedAttributes;
export default nodeAttributeFilterSlice.reducer;
