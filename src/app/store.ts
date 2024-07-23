import { combineReducers, configureStore, Store} from '@reduxjs/toolkit'
import graphViewButtonReducer from '../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphViewSlice';
import layoutReducer from '../util/ConfigExplorer/slice/LineageTab/Toolbar/LayoutSlice'
import graphExpansionReducer from '../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphExpansionSlice'
import reactFlowReducer from '../util/ConfigExplorer/slice/LineageTab/Toolbar/ReactFlowSlice'

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
 })

const store: Store = configureStore({
  reducer: rootReducer,
  middleware: customizedMiddleware,
})


export default store;
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch