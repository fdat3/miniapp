// src/ChatModule.js
import React, { useEffect } from 'react';
import { useStore } from 'react-redux';
import chatReducer from './state/chat.reducer';
import chatSaga from './state/chat.saga';
import ConversationList from './screens/ConversationList';

function ChatModule(props) {
  const store = useStore();
  useEffect(() => {
    if (store.injectReducer) store.injectReducer('miniapp/chat', chatReducer);
    if (store.injectSaga) store.injectSaga('miniapp/chat', chatSaga);
  }, [store]);

  return <ConversationList />;
}

export default ChatModule;