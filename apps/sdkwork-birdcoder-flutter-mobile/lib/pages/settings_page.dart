import 'package:flutter/material.dart';

import '../providers/app_provider.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = AppProvider.of(context);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(
          'Settings',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 12),
        Text('Route: app.settings.index'),
        Text('API: ${provider.apiBaseUrl}'),
        Text('Profile: ${provider.deploymentProfile}'),
        const SizedBox(height: 16),
        const Text(
          'Settings surface is aligned with the H5 mobile route catalog.',
        ),
      ],
    );
  }
}
