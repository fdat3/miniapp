import { createStore, combineReducers, applyMiddleware } from 'redux';
import createSagaMiddleware from 'redux-saga';

export function configureStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = createStore(
    combineReducers({ _placeholder: (s = {}) => s }), // reducer rỗng ban đầu
    applyMiddleware(sagaMiddleware)
  );

  store.asyncReducers = {};
  store.injectReducer = (key, reducer) => {
    if (store.asyncReducers[key]) return;
    store.asyncReducers[key] = reducer;
    store.replaceReducer(
      combineReducers({ _placeholder: (s = {}) => s, ...store.asyncReducers })
    );
  };

  store.asyncSagas = {};
  store.injectSaga = (key, saga) => {
    if (store.asyncSagas[key]) return;
    store.asyncSagas[key] = sagaMiddleware.run(saga);
  };

  return store;
}