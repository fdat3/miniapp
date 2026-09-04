import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useChatContext } from '../context/ChatContext';

export default function ConversationDetail({ route }) {
  const { conversationId, name } = route.params;
  const { token, apiBaseUrl, userId } = useChatContext();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `${apiBaseUrl}/chat/conversations/${conversationId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e) {
      console.log('[Chat] fetchMessages error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, conversationId, token]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const content = text.trim();
    setText('');
    setSending(true);

    // Optimistic update — hiện ngay trên UI trước khi API trả về
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = { id: tempId, senderId: userId, content, pending: true };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await fetch(
        `${apiBaseUrl}/chat/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const savedMessage = await res.json();

      // Thay message tạm bằng message thật từ server (có id chính thức)
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? savedMessage : m))
      );
    } catch (e) {
      // Gửi lỗi — đánh dấu message failed, cho phép gửi lại
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, failed: true, pending: false } : m))
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <Text style={styles.header}>{name}</Text>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.senderId === userId ? styles.bubbleMine : styles.bubbleOther,
              item.failed && styles.bubbleFailed,
            ]}
          >
            <Text style={item.senderId === userId ? styles.textMine : styles.textOther}>
              {item.content}
            </Text>
            {item.pending && <Text style={styles.statusText}>Đang gửi...</Text>}
            {item.failed && <Text style={styles.statusText}>Gửi thất bại</Text>}
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Nhập tin nhắn..."
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          <Text style={styles.sendText}>Gửi</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 18, fontWeight: 'bold', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  bubble: { marginHorizontal: 12, marginVertical: 4, padding: 10, borderRadius: 12, maxWidth: '75%' },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#4A90D9' },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#f0f0f0' },
  bubbleFailed: { opacity: 0.5, borderWidth: 1, borderColor: '#d00' },
  textMine: { color: '#fff' },
  textOther: { color: '#000' },
  statusText: { fontSize: 10, color: '#ddd', marginTop: 2 },
  inputRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, maxHeight: 100 },
  sendBtn: { backgroundColor: '#4A90D9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendText: { color: '#fff', fontWeight: '600' },
});