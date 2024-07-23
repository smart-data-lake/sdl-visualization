import { combineReducers, configureStore, Store } from '@reduxjs/toolkit'
import graphViewButtonReducer from '../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphViewSlice';
import layoutReducer from '../util/ConfigExplorer/slice/LineageTab/Toolbar/LayoutSlice'
import graphExpansionReducer from '../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphExpansionSlice'

const rootReducer = combineReducers({
    graphViewSelector: graphViewButtonReducer,
    layoutSelector: layoutReducer,
    graphExpansion: graphExpansionReducer
 })

const store: Store = configureStore({
  reducer: rootReducer,
})


export default store;
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch