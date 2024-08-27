import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../../../../app/store'


interface ExpansionState {
    isExpanded: boolean,
}
const initialState: ExpansionState = {
    isExpanded: false,
}

const ExpansionButtonSlice = createSlice({
    name: 'graphExpansion',
    initialState,
    reducers: {
        setExpansionState: (state, newState: PayloadAction<ExpansionState>) => {
            state.isExpanded = newState.payload.isExpanded;
        }
    }
})

export const {setExpansionState} = ExpansionButtonSlice.actions;
export const getExpansionState = (state: RootState) => state.graphExpansion.isExpanded;
export default ExpansionButtonSlice.reducer;