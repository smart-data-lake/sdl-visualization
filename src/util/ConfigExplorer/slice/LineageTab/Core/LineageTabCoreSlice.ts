import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../../../../app/store'
import { flowProps } from '../../../LineageTabUtils'


interface LineageTabState {
    lineageTabProps: flowProps
    lineageTabOpen: boolean
}
const initialState: LineageTabState = {
    lineageTabProps: {
        elementName: '',
        elementType: '',
        configData: undefined,
        runContext: undefined
    },
    lineageTabOpen: false
}

const LineageTabSlice = createSlice({
    name: 'lineage',
    initialState,
    reducers: {
        setLineageTabProps: (state, newState: PayloadAction<flowProps>) => {
            state.lineageTabProps = newState.payload;
        },
        setLineageTabOpen: (state, action: PayloadAction<boolean>) => {
            state.lineageTabOpen = action.payload;
        }
    }
})

export const {setLineageTabProps, setLineageTabOpen} = LineageTabSlice.actions;
export const getConfigData = (state: RootState) => state.lineage.lineageTabProps.configData;
export const getLineageTabProps = (state: RootState) => state.lineage.lineageTabProps;
export const getLineageTabOpen = (state: RootState) => state.lineage.lineageTabOpen;
export default LineageTabSlice.reducer;
