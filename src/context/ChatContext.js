import React, { createContext, useContext } from 'react';
const ChatContext = createContext(null);
export function ChatProvider({ value, children }) {
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
export function useChatContext() {
  return useContext(ChatContext);
}
