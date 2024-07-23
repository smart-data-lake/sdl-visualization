import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../../../../app/store'
import { LayoutDirection } from '../../../LineageTabUtils'


interface LayoutState {
    layout: LayoutDirection;
}
const initialState: LayoutState = {
    layout: 'TB'
}

const layoutButtonSlice = createSlice({
    name: 'layoutSelector',
    initialState,
    reducers: {
        setLayout: (state, newState: PayloadAction<LayoutDirection>) => {
            state.layout = newState.payload;
        }
    }
})

export const {setLayout} = layoutButtonSlice.actions;
export const getLayout = (state: RootState) => state.layoutSelector.layout;
export default layoutButtonSlice.reducer;