import { combineReducers, configureStore, Store} from '@reduxjs/toolkit'
import graphViewButtonReducer from '../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphViewSlice';
import layoutReducer from '../util/ConfigExplorer/slice/LineageTab/Toolbar/LayoutSlice'
import graphExpansionReducer from '../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphExpansionSlice'
import reactFlowReducer from '../util/ConfigExplorer/slice/LineageTab/Common/ReactFlowSlice'
import lineageTabReducer from '../util/ConfigExplorer/slice/LineageTab/Core/LineageTabCoreSlice'

// disable serialization check on rfi
const customizedMiddleware = (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: false
    //   ignoredActions: ['reactFlow/setReactFlowInstance'],
    //   ignoredPaths: ['reactFlow.rfi']
  });

const rootReducer = combineReducers({
    graphViewSelector: graphViewButtonReducer,
    layoutSelector: layoutReducer,
    graphExpansion: graphExpansionReducer,
    reactFlow: reactFlowReducer,
    lineage: lineageTabReducer
 })

const store: Store = configureStore({
  reducer: rootReducer,
  middleware: customizedMiddleware,
})


export default store;
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch