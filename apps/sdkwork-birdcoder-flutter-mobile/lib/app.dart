import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_shell/sdkwork_birdcoder_flutter_mobile_shell.dart';

import 'auth_gate.dart';
import 'providers/app_provider.dart';
import 'routes/app_router.dart';
import 'routing/route_page_factory.dart';
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
            child: buildBirdCoderRoutePageForPath('/'),
          ),
        ),
      ),
    );
  }
}
