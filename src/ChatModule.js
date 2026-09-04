import React, { useEffect } from 'react';
import { useStore } from 'react-redux';
import chatReducer from './state/chat.reducer';
import chatSaga from './state/chat.saga';

export default function ChatModule() {
  const store = useStore();
  useEffect(() => {
    if (store.injectReducer) store.injectReducer('miniapp/chat', chatReducer);
    if (store.injectSaga) store.injectSaga('miniapp/chat', chatSaga);
  }, [store]);
  return null; // logic thuần, UI đi qua route riêng
}