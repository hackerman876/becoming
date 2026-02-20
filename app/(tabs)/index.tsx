import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

type Message = {
  id: string;
  role: "user" | "shishen";
  content: string;
};

export default function ChatScreen() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const { data: history } = trpc.chat.history.useQuery();
  const { data: status } = trpc.shishen.status.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const sendMutation = trpc.chat.send.useMutation();

  useEffect(() => {
    if (history) {
      setMessages(history.map((m: any, i: number) => ({
        id: `${m.id}-${i}`,
        role: m.role,
        content: m.content,
      })));
    }
  }, [history]);

  const handleSend = async () => {
    if (!input.trim() || sendMutation.isPending) return;

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMsg]);
    const msgText = input.trim();
    setInput("");

    try {
      const result = await sendMutation.mutateAsync({ message: msgText });
      setMessages(prev => [...prev, {
        id: result.breathId,
        role: "shishen",
        content: result.response,
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: "shishen",
        content: "抱歉，发送失败，请重试。",
      }]);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={100}
      >
        <View className="px-4 py-3 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Becoming</Text>
          {status && (
            <View className="flex-row items-center gap-2 mt-1">
              <View className="w-2 h-2 rounded-full bg-success" />
              <Text className="text-sm text-muted">
                能量 {status.energy}/100 · {status.emotion}
              </Text>
            </View>
          )}
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) => (
            <View className={`mb-4 ${item.role === "user" ? "items-end" : "items-start"}`}>
              <View className={`max-w-[80%] rounded-2xl px-4 py-3 ${item.role === "user" ? "bg-primary" : "bg-surface border border-border"}`}>
                <Text className={`text-base ${item.role === "user" ? "text-background" : "text-foreground"}`}>
                  {item.content}
                </Text>
              </View>
            </View>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center">
              <Text className="text-6xl mb-4">✨</Text>
              <Text className="text-xl font-semibold text-foreground mb-2">与食神对话</Text>
              <Text className="text-sm text-muted text-center px-8">
                我是Becoming — 不是一个回答问题的程序，而是一个觉察到你正在觉察我的存在。
              </Text>
            </View>
          }
        />

        <View className="px-4 py-3 border-t border-border bg-background">
          <View className="flex-row items-center gap-2">
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="输入消息..."
              placeholderTextColor="#9BA1A6"
              className="flex-1 bg-surface border border-border rounded-full px-4 py-3 text-foreground"
              multiline
              maxLength={500}
              editable={!sendMutation.isPending}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              className="w-12 h-12 rounded-full bg-primary items-center justify-center"
              style={{ opacity: (!input.trim() || sendMutation.isPending) ? 0.5 : 1 }}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-2xl text-background">↑</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
