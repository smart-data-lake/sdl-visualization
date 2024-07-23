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
        setLayoutTo: (state, newState: PayloadAction<LayoutDirection>) => {
            state.layout = newState.payload;
        }
    }
})

export const {setLayoutTo} = layoutButtonSlice.actions;
export const getLayout = (state: RootState) => state.layoutSelector.layout;
export default layoutButtonSlice.reducer;