import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_chat/sdkwork_birdcoder_flutter_mobile_chat.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';

import '../l10n/generated/app_localizations.dart';
import '../providers/app_provider.dart';

/// Mobile chat surface wired through the BirdCoder app SDK chat conversation API.
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
  String? _conversationId;
  bool _isLoadingHistory = false;
  bool _isSending = false;
  String? _lastError;

  BirdCoderFlutterSdkClients get _sdkClients => AppProvider.of(context).sdkClients;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadHistory();
    });
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    _inputFocusNode.dispose();
    super.dispose();
  }

  DateTime _parseTimestamp(String value) {
    return DateTime.tryParse(value) ?? DateTime.now();
  }

  ChatMessage _toChatMessage(BirdCoderMobileChatMessageRecord record) {
    return ChatMessage(
      id: record.id,
      role: record.role,
      content: record.content,
      timestamp: _parseTimestamp(record.createdAt),
    );
  }

  Future<void> _loadHistory() async {
    setState(() {
      _isLoadingHistory = true;
      _lastError = null;
    });
    try {
      final id = await ensureBirdCoderMobileChatConversation(_sdkClients);
      final history = await listBirdCoderMobileChatMessages(_sdkClients, id);
      if (!mounted) {
        return;
      }
      setState(() {
        _conversationId = id;
        _messages
          ..clear()
          ..addAll(history.map(_toChatMessage));
        _isLoadingHistory = false;
      });
      _scrollToBottom();
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _lastError = 'Failed to load chat history.';
        _isLoadingHistory = false;
      });
    }
  }

  Future<void> _sendMessage() async {
    final text = _inputController.text.trim();
    final conversationId = _conversationId;
    if (text.isEmpty || _isSending || conversationId == null) {
      return;
    }

    setState(() {
      _isSending = true;
      _lastError = null;
    });
    _inputController.clear();
    _inputFocusNode.requestFocus();

    try {
      final saved = await sendBirdCoderMobileChatMessage(
        _sdkClients,
        conversationId,
        text,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _messages.add(_toChatMessage(saved));
        _isSending = false;
      });
      _scrollToBottom();
    } catch (_) {
      if (!mounted) {
        return;
      }
      final l10n = AppLocalizations.of(context)!;
      setState(() {
        _lastError = l10n.chat_send_failed;
        _isSending = false;
      });
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) {
        return;
      }
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
    final l10n = AppLocalizations.of(context)!;
    return Column(
      children: <Widget>[
        Expanded(
          child: _isLoadingHistory
              ? _buildLoading(theme, l10n)
              : _messages.isEmpty
                  ? _buildEmpty(theme, l10n)
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      itemCount: _messages.length,
                      itemBuilder: (BuildContext context, int index) =>
                          _ChatMessageBubble(
                        message: _messages[index],
                        isUser: _isUserMessage(_messages[index]),
                      ),
                    ),
        ),
        if (_lastError != null) _buildErrorBar(theme, _lastError!),
        _buildComposer(theme, l10n),
      ],
    );
  }

  Widget _buildLoading(ThemeData theme, AppLocalizations l10n) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const CircularProgressIndicator(),
            const SizedBox(height: 12),
            Text(l10n.chat_loading_history, style: theme.textTheme.bodyMedium),
          ],
        ),
      );

  Widget _buildEmpty(ThemeData theme, AppLocalizations l10n) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            l10n.chat_empty,
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
              Icon(
                Icons.error_outline,
                size: 18,
                color: theme.colorScheme.onErrorContainer,
              ),
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
                icon: Icon(
                  Icons.refresh,
                  size: 18,
                  color: theme.colorScheme.onErrorContainer,
                ),
                onPressed: _isLoadingHistory ? null : _loadHistory,
              ),
            ],
          ),
        ),
      );

  Widget _buildComposer(ThemeData theme, AppLocalizations l10n) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final canSend = _conversationId != null && !_isSending;
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
                enabled: canSend,
                decoration: InputDecoration(
                  hintText: l10n.chat_input_placeholder,
                  border: const OutlineInputBorder(),
                  filled: true,
                  fillColor: theme.colorScheme.surfaceContainerHighest,
                ),
                onSubmitted: (_) => _sendMessage(),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              tooltip: l10n.chat_send,
              onPressed: canSend ? _sendMessage : null,
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
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
