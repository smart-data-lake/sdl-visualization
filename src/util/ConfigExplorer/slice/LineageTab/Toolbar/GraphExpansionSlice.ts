import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../../../../app/store'


interface ExpansionState {
    isExpanded: boolean,
}
const initialState: ExpansionState = {
    isExpanded: false,
}

const ExpansionButtonSlice = createSlice({
    name: 'expandGraph',
    initialState,
    reducers: {
        setExpansionStateTo: (state, newState: PayloadAction<ExpansionState>) => {
            state.isExpanded = newState.payload.isExpanded;
        }
    }
})

export const {setExpansionStateTo} = ExpansionButtonSlice.actions;
export const getExpansionState = (state: RootState) => state.graphExpansion.isExpanded;
export default ExpansionButtonSlice.reducer;