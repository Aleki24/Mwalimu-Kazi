import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { formatPostedAge } from '@mwalimu/core';
import { colors, radius, shadow } from '@mwalimu/ui';
import { Avatar, Card, EmptyState, ErrorBanner } from '../components/ui';
import { CommentThread } from '../components/comment-thread';
import {
  addPostComment, createPost, fetchFeedPage, fetchPostComments, setPostLike,
  type FeedPost,
} from '../lib/social';
import { useTeacher } from '../lib/auth';

const MAX_POST = 1000;

function PostCard({ item, now, viewerId, onChanged }: {
  item: FeedPost;
  now: Date;
  viewerId: string;
  onChanged: () => void;
}) {
  const [liked, setLiked] = useState(item.likedByMe);
  const [count, setCount] = useState(item.likeCount);
  const [open, setOpen] = useState(false);

  const toggleLike = async () => {
    const next = !liked;
    // Optimistic: a like is reversible in one tap and must feel instant.
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      await setPostLike(item.post.id, viewerId, next);
    } catch {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
  };

  return (
    <Card className="gap-2 px-3.5 py-3">
      <View className="flex-row items-center gap-2.5">
        <Avatar name={item.author?.fullName ?? '?'} size={32} />
        <View className="min-w-0 flex-1">
          <Text className="text-[12.5px] font-medium text-foreground">
            {item.author?.fullName ?? 'Former member'}
          </Text>
          <Text className="text-[10.5px] text-mutedForeground">
            {item.author?.headline ?? 'Teacher'} · {formatPostedAge(new Date(item.post.created_at), now)}
          </Text>
        </View>
      </View>

      <Text className="text-[13.5px] leading-5 text-foreground">{item.post.body}</Text>

      <View className="flex-row gap-4 pt-0.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: liked }}
          onPress={() => void toggleLike()}
          hitSlop={8}
          className="flex-row items-center gap-1.5"
        >
          <Feather
            name="heart"
            size={14}
            color={liked ? colors.destructiveForeground : colors.mutedForeground}
          />
          <Text className={`text-[11.5px] ${liked ? 'text-destructiveForeground' : 'text-mutedForeground'}`}>
            {count}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen((v) => !v)}
          hitSlop={8}
          className="flex-row items-center gap-1.5"
        >
          <Feather name="message-circle" size={14} color={colors.mutedForeground} />
          <Text className="text-[11.5px] text-mutedForeground">{item.commentCount}</Text>
        </Pressable>
      </View>

      {open ? (
        <View className="border-t border-border pt-2.5">
          <CommentThread
            load={() => fetchPostComments(item.post.id)}
            send={async (body) => { await addPostComment(item.post.id, viewerId, body); onChanged(); }}
            emptyHint="No replies yet."
          />
        </View>
      ) : null}
    </Card>
  );
}

export default function FeedScreen() {
  const teacher = useTeacher();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<readonly FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [now] = useState(() => new Date());

  const loadFirst = useCallback(async () => {
    try {
      const page = await fetchFeedPage(null, teacher.id);
      setPosts(page.posts);
      setCursor(page.next);
      setDone(page.next === null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the feed');
    } finally {
      setLoading(false);
    }
  }, [teacher.id]);

  useEffect(() => { void loadFirst(); }, [loadFirst]);

  const loadMore = async () => {
    // Guarded on all three: onEndReached fires repeatedly while a slow page is
    // still in flight, and without this the same page loads several times.
    if (done || loadingMore || cursor === null) return;
    setLoadingMore(true);
    try {
      const page = await fetchFeedPage(cursor, teacher.id);
      setPosts((prev) => [...prev, ...page.posts]);
      setCursor(page.next);
      setDone(page.next === null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load more');
    } finally {
      setLoadingMore(false);
    }
  };

  const publish = async () => {
    const body = draft.trim();
    if (body === '' || posting) return;
    setPosting(true);
    try {
      await createPost(teacher.id, body);
      setDraft('');
      await loadFirst();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not post');
    } finally {
      setPosting(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Staffroom' }} />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.post.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}
        onEndReachedThreshold={0.6}
        onEndReached={() => void loadMore()}
        ListHeaderComponent={
          <View className="gap-2.5 pb-1">
            {error !== null ? <ErrorBanner message={error} /> : null}
            <Card className="gap-2 px-3.5 py-3">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Ask the staffroom something, or share what worked this term…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={MAX_POST}
                className="min-h-[64px] text-[13.5px] leading-5 text-foreground"
              />
              <View className="flex-row items-center justify-between">
                <Text className="text-[10.5px] text-mutedForeground">
                  {MAX_POST - draft.trim().length} left
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={draft.trim() === '' || posting}
                  onPress={() => void publish()}
                  style={{ borderRadius: radius.pill }}
                  className={`h-9 justify-center px-4 ${
                    draft.trim() === '' || posting ? 'bg-wash' : 'bg-primary'
                  }`}
                >
                  <Text
                    className={`text-[12.5px] font-medium ${
                      draft.trim() === '' || posting ? 'text-mutedForeground' : 'text-primaryForeground'
                    }`}
                  >
                    {posting ? 'Posting…' : 'Post'}
                  </Text>
                </Pressable>
              </View>
            </Card>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.mutedForeground} className="py-10" />
          ) : (
            <EmptyState
              title="Nothing here yet"
              body="Be the first. Ask about a school, share a scheme of work, or say what your term is like."
            />
          )
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={colors.mutedForeground} className="py-4" />
          : done && posts.length > 0
            ? <Text className="py-4 text-center text-[11px] text-mutedForeground">That is everything.</Text>
            : null
        }
        renderItem={({ item }) => (
          <PostCard item={item} now={now} viewerId={teacher.id} onChanged={() => void loadFirst()} />
        )}
      />
    </View>
  );
}
