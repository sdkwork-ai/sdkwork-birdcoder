library sdkwork_birdcoder_flutter_mobile_chat;

const String kFlutterMobileChatVersion = '0.1.0';

class ChatMessage {
  final String id;
  final String role;
  final String content;
  final DateTime timestamp;

  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.timestamp,
  });

  static ChatMessage create({
    required String role,
    required String content,
  }) {
    return ChatMessage(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      role: role,
      content: content,
      timestamp: DateTime.now(),
    );
  }
}
