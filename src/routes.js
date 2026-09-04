import ConversationList from './screens/ConversationList';
import ConversationDetail from './screens/ConversationDetail';

export const CHAT_ROUTES = {
  CONVERSATION_LIST: 'ChatConversationList',
  CONVERSATION_DETAIL: 'ChatConversationDetail',
};

export const chatRoutes = [
  { name: CHAT_ROUTES.CONVERSATION_LIST, component: ConversationList },
  { name: CHAT_ROUTES.CONVERSATION_DETAIL, component: ConversationDetail },
];