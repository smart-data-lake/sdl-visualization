import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../../../../app/store';

interface GroupingState {
    view: Boolean;
}
const initialState: GroupingState = {
    view: true
}

const groupingButtonSlice = createSlice({
    name: 'grouping',
    initialState,
    reducers: {
        setGroupingState: (state, newView: PayloadAction<Boolean>) => {
            state.view = newView.payload
        }
    }
})

export const {setGroupingState} = groupingButtonSlice.actions;
export const getGraphView = (state: RootState) => state.graphViewSelector.view;
export default groupingButtonSlice.reducer;