import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_shell/sdkwork_birdcoder_flutter_mobile_shell.dart';

import 'auth_gate.dart';
import 'providers/app_provider.dart';
import 'routes/app_router.dart';
import 'shell/app_shell.dart';

class BirdcoderApp extends StatelessWidget {
  final BirdCoderFlutterBootstrapState bootstrapState;

  const BirdcoderApp({
    super.key,
    required this.bootstrapState,
  });

  @override
  Widget build(BuildContext context) {
    final shellConfig = ShellConfig.defaultConfig();

    return AppProvider(
      bootstrapState: bootstrapState,
      child: MaterialApp(
        title: shellConfig.title,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
          useMaterial3: true,
        ),
        onGenerateRoute: AppRouter.generateRoute,
        home: AuthGate(
          child: AppShell(
            bootstrapState: bootstrapState,
            child: const _HomePlaceholder(),
          ),
        ),
      ),
    );
  }
}

class _HomePlaceholder extends StatelessWidget {
  const _HomePlaceholder();

  @override
  Widget build(BuildContext context) {
    final provider = AppProvider.of(context);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'SDKWork BirdCoder Flutter Mobile',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          Text('API: ${provider.apiBaseUrl}'),
          Text('Profile: ${provider.deploymentProfile}'),
          Text('Routes: ${provider.routes.length}'),
          const SizedBox(height: 12),
          const Text(
            'Mobile shell bootstrap, IAM runtime, and auth gate are active.',
          ),
        ],
      ),
    );
  }
}
