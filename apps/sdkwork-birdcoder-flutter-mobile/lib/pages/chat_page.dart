import 'package:flutter/material.dart';

import '../providers/app_provider.dart';

class ChatPage extends StatelessWidget {
  const ChatPage({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = AppProvider.of(context);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(
          'Chat',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 12),
        Text('Route: app.chat.index'),
        Text('API: ${provider.apiBaseUrl}'),
        Text('Profile: ${provider.deploymentProfile}'),
        const SizedBox(height: 16),
        const Text(
          'Mobile chat surface is wired through the canonical Flutter route catalog.',
        ),
      ],
    );
  }
}
