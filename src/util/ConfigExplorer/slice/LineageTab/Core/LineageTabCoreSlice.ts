import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../../../../app/store'
import { flowProps } from '../../../LineageTabUtils'


interface LinageTabState {
    lineageTabProps: flowProps
}
const initialState: LinageTabState = {
    lineageTabProps: {
        elementName: '',
        elementType: '',
        configData: undefined,
        runContext: undefined
    }
}

const LineageTabSlice = createSlice({
    name: 'lineage',
    initialState,
    reducers: {
        setLineageTabProps: (state, newState: PayloadAction<flowProps>) => {
            state.lineageTabProps = newState.payload;
        }
    }
})

export const {setLineageTabProps} = LineageTabSlice.actions;
export const getConfigData = (state: RootState) => state.lineage.lineageTabProps.configData;
export const getLineageTabProps = (state: RootState) => state.lineage.lineageTabProps;
export default LineageTabSlice.reducer;