import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';

import '../l10n/generated/app_localizations.dart';
import '../providers/app_provider.dart';

/// Mobile assistant surface backed by Agents Session, Turn, and SessionItem.
class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _inputFocusNode = FocusNode();
  final List<BirdCoderAgentSessionItemView> _sessionItems =
      <BirdCoderAgentSessionItemView>[];
  String? _sessionId;
  bool _isLoadingHistory = false;
  bool _isSending = false;
  String? _lastError;

  BirdCoderFlutterSdkClients get _sdkClients =>
      AppProvider.of(context).sdkClients;

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

  Future<void> _loadHistory() async {
    setState(() {
      _isLoadingHistory = true;
      _lastError = null;
    });
    try {
      final session = await ensureBirdCoderAssistantSession(_sdkClients);
      final latestPage = session.itemCount == 0
          ? 1
          : (session.itemCount + birdCoderAssistantSessionPageSize - 1) ~/
              birdCoderAssistantSessionPageSize;
      final items = await listBirdCoderAssistantSessionItems(
        _sdkClients,
        session.sessionId,
        page: latestPage,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _sessionId = session.sessionId;
        _sessionItems
          ..clear()
          ..addAll(items);
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

  Future<void> _sendTurn() async {
    final text = _inputController.text.trim();
    final sessionId = _sessionId;
    if (text.isEmpty || _isSending || sessionId == null) {
      return;
    }

    setState(() {
      _isSending = true;
      _lastError = null;
    });
    _inputController.clear();
    _inputFocusNode.requestFocus();

    try {
      final completedItems = await submitBirdCoderAssistantTurn(
        _sdkClients,
        sessionId,
        text,
      );
      if (!mounted) {
        return;
      }
      final mergedItems = _mergeSessionItems(_sessionItems, completedItems);
      setState(() {
        _sessionItems
          ..clear()
          ..addAll(mergedItems);
        _isSending = false;
      });
      _scrollToBottom();
    } catch (_) {
      if (!mounted) {
        return;
      }
      final l10n = AppLocalizations.of(context)!;
      setState(() {
        if (_inputController.text.isEmpty) {
          _inputController.text = text;
        }
        _lastError = l10n.agent_session_send_failed;
        _isSending = false;
      });
    }
  }

  List<BirdCoderAgentSessionItemView> _mergeSessionItems(
    Iterable<BirdCoderAgentSessionItemView> current,
    Iterable<BirdCoderAgentSessionItemView> incoming,
  ) {
    final itemsById = <String, BirdCoderAgentSessionItemView>{
      for (final item in current) item.itemId: item,
      for (final item in incoming) item.itemId: item,
    };
    final merged = itemsById.values.toList(growable: false)
      ..sort((left, right) => left.sequence.compareTo(right.sequence));
    return merged;
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

  bool _isUserItem(BirdCoderAgentSessionItemView item) => item.role == 'user';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context)!;
    return Column(
      children: <Widget>[
        Expanded(
          child: _isLoadingHistory
              ? _buildLoading(theme, l10n)
              : _sessionItems.isEmpty
                  ? _buildEmpty(theme, l10n)
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      itemCount: _sessionItems.length,
                      itemBuilder: (BuildContext context, int index) =>
                          _AgentSessionItemBubble(
                        item: _sessionItems[index],
                        isUser: _isUserItem(_sessionItems[index]),
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
            Text(
              l10n.agent_session_loading_items,
              style: theme.textTheme.bodyMedium,
            ),
          ],
        ),
      );

  Widget _buildEmpty(ThemeData theme, AppLocalizations l10n) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            l10n.agent_session_empty,
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
    final canSend = _sessionId != null && !_isSending;
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
                  hintText: l10n.agent_session_input_placeholder,
                  border: const OutlineInputBorder(),
                  filled: true,
                  fillColor: theme.colorScheme.surfaceContainerHighest,
                ),
                onSubmitted: (_) => _sendTurn(),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              tooltip: l10n.agent_session_send,
              onPressed: canSend ? _sendTurn : null,
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

class _AgentSessionItemBubble extends StatelessWidget {
  const _AgentSessionItemBubble({required this.item, required this.isUser});

  final BirdCoderAgentSessionItemView item;
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
            item.content,
            style: theme.textTheme.bodyMedium?.copyWith(color: textColor),
          ),
        ),
      ),
    );
  }
}
