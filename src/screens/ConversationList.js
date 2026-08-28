import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

const MOCK_CONVERSATIONS = [
  { id: '1', name: 'Phat' },
  { id: '2', name: 'Dat' },
];

export default function ConversationList(props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chat</Text>
      <FlatList
        data={MOCK_CONVERSATIONS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text>{item.name}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  item: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
});
