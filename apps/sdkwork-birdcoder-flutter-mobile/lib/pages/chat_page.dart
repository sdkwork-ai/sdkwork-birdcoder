import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_chat/sdkwork_birdcoder_flutter_mobile_chat.dart';

/// Mobile chat surface wired through the canonical Flutter route catalog.
///
/// State is local until the backend chat API is wired through
/// `@sdkwork/birdcoder-chat-shared`. Send/history calls are mocked today.
class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _inputFocusNode = FocusNode();
  final List<ChatMessage> _messages = <ChatMessage>[];
  bool _isLoadingHistory = false;
  bool _isSending = false;
  String? _lastError;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    _inputFocusNode.dispose();
    super.dispose();
  }

  // Mock history loader. Future integration target:
  // `@sdkwork/birdcoder-chat-shared` backend chat API.
  Future<void> _loadHistory() async {
    setState(() {
      _isLoadingHistory = true;
      _lastError = null;
    });
    try {
      await Future<void>.delayed(const Duration(milliseconds: 600));
      if (!mounted) return;
      final now = DateTime.now();
      setState(() {
        _messages
          ..add(ChatMessage(
            id: 'history-welcome',
            role: 'assistant',
            content: 'Hi! I am BirdCoder. How can I help you today?',
            timestamp: now.subtract(const Duration(minutes: 5)),
          ))
          ..add(ChatMessage(
            id: 'history-hint',
            role: 'assistant',
            content: 'Ask me about code, files, or SDK workflows.',
            timestamp: now.subtract(const Duration(minutes: 4)),
          ));
        _isLoadingHistory = false;
      });
      _scrollToBottom();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _lastError = 'Failed to load chat history.';
        _isLoadingHistory = false;
      });
    }
  }

  // Mock send. Future integration target:
  // `@sdkwork/birdcoder-chat-shared` backend chat API.
  Future<void> _sendMessage() async {
    final text = _inputController.text.trim();
    if (text.isEmpty || _isSending) return;

    setState(() {
      _messages.add(ChatMessage.create(role: 'user', content: text));
      _isSending = true;
      _lastError = null;
    });
    _inputController.clear();
    _inputFocusNode.requestFocus();
    _scrollToBottom();

    try {
      await Future<void>.delayed(const Duration(milliseconds: 800));
      if (!mounted) return;
      final now = DateTime.now();
      setState(() {
        _messages.add(ChatMessage(
          id: now.millisecondsSinceEpoch.toString(),
          role: 'assistant',
          content: 'Mock reply to "$text". '
              'Backend chat API will be wired through @sdkwork/birdcoder-chat-shared.',
          timestamp: now,
        ));
        _isSending = false;
      });
      _scrollToBottom();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _lastError = 'Failed to send message.';
        _isSending = false;
      });
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  bool _isUserMessage(ChatMessage message) =>
      message.role == 'user' || message.role.startsWith('user.');

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: <Widget>[
        Expanded(
          child: _isLoadingHistory
              ? _buildLoading(theme)
              : _messages.isEmpty
                  ? _buildEmpty(theme)
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      itemCount: _messages.length,
                      itemBuilder: (BuildContext context, int index) =>
                          _ChatMessageBubble(
                        message: _messages[index],
                        isUser: _isUserMessage(_messages[index]),
                      ),
                    ),
        ),
        if (_lastError != null) _buildErrorBar(theme, _lastError!),
        _buildComposer(theme),
      ],
    );
  }

  Widget _buildLoading(ThemeData theme) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const CircularProgressIndicator(),
            const SizedBox(height: 12),
            Text('Loading chat history...', style: theme.textTheme.bodyMedium),
          ],
        ),
      );

  Widget _buildEmpty(ThemeData theme) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'No messages yet. Start a conversation below.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
        ),
      );

  Widget _buildErrorBar(ThemeData theme, String error) => Material(
        color: theme.colorScheme.errorContainer,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: <Widget>[
              Icon(Icons.error_outline,
                  size: 18, color: theme.colorScheme.onErrorContainer),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  error,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.onErrorContainer),
                ),
              ),
              IconButton(
                tooltip: 'Retry',
                icon: Icon(Icons.refresh,
                    size: 18, color: theme.colorScheme.onErrorContainer),
                onPressed: _isLoadingHistory ? null : _loadHistory,
              ),
            ],
          ),
        ),
      );

  Widget _buildComposer(ThemeData theme) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(12, 8, 12, 8 + bottomInset),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: <Widget>[
            Expanded(
              child: TextField(
                controller: _inputController,
                focusNode: _inputFocusNode,
                textInputAction: TextInputAction.send,
                minLines: 1,
                maxLines: 5,
                enabled: !_isSending,
                decoration: InputDecoration(
                  hintText: 'Send a message...',
                  border: const OutlineInputBorder(),
                  filled: true,
                  fillColor: theme.colorScheme.surfaceContainerHighest,
                ),
                onSubmitted: (_) => _sendMessage(),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              tooltip: 'Send',
              onPressed: _isSending ? null : _sendMessage,
              icon: _isSending
                  ? SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: theme.colorScheme.onPrimary,
                      ),
                    )
                  : const Icon(Icons.send),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChatMessageBubble extends StatelessWidget {
  const _ChatMessageBubble({required this.message, required this.isUser});

  final ChatMessage message;
  final bool isUser;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bubbleColor = isUser
        ? theme.colorScheme.primaryContainer
        : theme.colorScheme.surfaceContainerHighest;
    final textColor = isUser
        ? theme.colorScheme.onPrimaryContainer
        : theme.colorScheme.onSurface;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Align(
        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.78,
          ),
          padding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: bubbleColor,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(14),
              topRight: const Radius.circular(14),
              bottomLeft: isUser ? const Radius.circular(14) : Radius.zero,
              bottomRight: isUser ? Radius.zero : const Radius.circular(14),
            ),
          ),
          child: Text(
            message.content,
            style: theme.textTheme.bodyMedium?.copyWith(color: textColor),
          ),
        ),
      ),
    );
  }
}
