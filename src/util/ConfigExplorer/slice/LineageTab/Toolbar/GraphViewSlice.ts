import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../../../../app/store'
import { GraphView } from '../../../LineageTabUtils'


interface GraphViewState {
    view: GraphView;
}
const initialState: GraphViewState = {
    view: 'full'
}

const graphViewButtonSlice = createSlice({
    name: 'graphViewSelector',
    initialState,
    reducers: {
        setGraphViewTo: (state, newView: PayloadAction<GraphView>) => {
            state.view = newView.payload
        }
    }
})

export const {setGraphViewTo} = graphViewButtonSlice.actions;
export const getView = (state: RootState) => state.graphViewSelector.view;
export default graphViewButtonSlice.reducer;