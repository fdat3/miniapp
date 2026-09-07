import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

// ============================================================
// CONFIG
// ============================================================
// Dùng JSONPlaceholder (API public, miễn phí, không cần key) để mô phỏng
// việc mini-app gọi API thật từ internet khi chạy trong super app.
// Khi tích hợp thật, thay API_BASE_URL bằng endpoint backend Chudu24
// và truyền authToken (nhận từ super app) vào header Authorization.
const API_BASE_URL = 'https://jsonplaceholder.typicode.com';
const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;

// Map dữ liệu /users thành "cuộc trò chuyện" để giữ đúng UI cũ
function mapUserToConversation(user, posts) {
  const userPosts = posts.filter((p) => p.userId === user.id);
  const last = userPosts[userPosts.length - 1];
  return {
    id: String(user.id),
    name: user.name,
    lastMessage: last ? last.title : 'Chưa có tin nhắn',
    unread: userPosts.length % 6, // giả lập số tin chưa đọc
  };
}

// ============================================================
// Hook: gọi API thật, có loading / error / retry / pull-to-refresh
// ============================================================
function useConversations({ token, page, search } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      // Hủy request cũ nếu còn đang chạy (tránh race condition khi gõ search nhanh)
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);

      try {
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const [usersRes, postsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/users`, { signal: controller.signal, headers }),
          fetch(`${API_BASE_URL}/posts`, { signal: controller.signal, headers }),
        ]);

        if (!usersRes.ok || !postsRes.ok) {
          throw new Error(`HTTP ${usersRes.status || postsRes.status}`);
        }

        const users = await usersRes.json();
        const posts = await postsRes.json();

        let conversations = users.map((u) => mapUserToConversation(u, posts));

        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          conversations = conversations.filter((c) =>
            c.name.toLowerCase().includes(q)
          );
        }

        // Phân trang giả lập ở client vì JSONPlaceholder không hỗ trợ search/paging kiểu này
        const paged = conversations.slice(0, page * PAGE_SIZE);
        setData(paged);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Không thể tải dữ liệu');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, page, search]
  );

  useEffect(() => {
    fetchData();
    return () => abortRef.current && abortRef.current.abort();
  }, [fetchData]);

  return { data, loading, refreshing, error, refetch: fetchData };
}

// ============================================================
// Item con
// ============================================================
function ConversationItem({ item, onPress, expanded }) {
  const scale = useState(new Animated.Value(1))[0];

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.item}
        activeOpacity={0.8}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.itemRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
          </View>
          <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unread}</Text>
                </View>
              )}
            </View>
            <Text
              style={styles.itemMessage}
              numberOfLines={expanded ? undefined : 1}
            >
              {item.lastMessage}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================================
// Component chính
// ============================================================
// Props thật sự sẽ nhận từ super app (Chudu24App) khi mini-app được host:
//   - token: JWT auth token
//   - userInfo: thông tin user hiện tại
//   - socketInstance: socket dùng chung (chưa dùng ở bản này, để hook realtime sau)
export default function ConversationList({ token, userInfo, socketInstance }) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce search để không gọi API mỗi lần gõ phím
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1); // reset trang khi đổi từ khóa
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, loading, refreshing, error, refetch } = useConversations({
    token,
    page,
    search: debouncedSearch,
  });

  const totalUnread = useMemo(
    () => data.reduce((sum, c) => sum + c.unread, 0),
    [data]
  );

  const handleLoadMore = () => {
    if (loading || loadingMore) return;
    setLoadingMore(true);
    setPage((p) => p + 1);
    // loadingMore sẽ tự tắt khi data mới về (useEffect bên dưới)
  };

  useEffect(() => {
    if (!loading) setLoadingMore(false);
  }, [loading]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Chat{userInfo?.name ? ` · ${userInfo.name}` : ''}
        </Text>
        {totalUnread > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{totalUnread} chưa đọc</Text>
          </View>
        )}
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Tìm cuộc trò chuyện..."
        placeholderTextColor="#999"
        value={searchInput}
        onChangeText={setSearchInput}
      />

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Lỗi: {error}</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && !refreshing && data.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#4A90D9" />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationItem
              item={item}
              expanded={expandedId === item.id}
              onPress={() =>
                setExpandedId(expandedId === item.id ? null : item.id)
              }
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => refetch(true)}
              colors={['#4A90D9']}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color="#4A90D9" />
            ) : null
          }
          ListEmptyComponent={
            !loading && (
              <Text style={styles.emptyText}>Không tìm thấy kết quả</Text>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: 'bold' },
  headerBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 15,
  },
  errorBox: {
    backgroundColor: '#FFF1F0',
    borderColor: '#FFA39E',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: { color: '#CF1322', fontSize: 13, flex: 1 },
  retryBtn: {
    backgroundColor: '#CF1322',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  item: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  itemContent: { flex: 1 },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: { fontSize: 16, fontWeight: '600', flex: 1 },
  itemMessage: { fontSize: 13, color: '#777', marginTop: 2 },
  badge: {
    backgroundColor: '#34C759',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },
});