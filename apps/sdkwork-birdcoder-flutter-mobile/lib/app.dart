import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_shell/sdkwork_birdcoder_flutter_mobile_shell.dart';

import 'auth_gate.dart';
import 'l10n/l10n.dart';
import 'providers/app_provider.dart';
import 'providers/theme_controller.dart';
import 'routes/app_router.dart';
import 'routing/route_page_factory.dart';
import 'shell/app_shell.dart';

class BirdcoderApp extends StatefulWidget {
  final BirdCoderFlutterBootstrapState bootstrapState;

  const BirdcoderApp({
    super.key,
    required this.bootstrapState,
  });

  @override
  State<BirdcoderApp> createState() => _BirdcoderAppState();
}

class _BirdcoderAppState extends State<BirdcoderApp> {
  final ThemeController _themeController = ThemeController();

  @override
  void initState() {
    super.initState();
    _themeController.hydrate();
  }

  @override
  void dispose() {
    _themeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final shellConfig = ShellConfig.defaultConfig();

    return AppProvider(
      bootstrapState: widget.bootstrapState,
      themeController: _themeController,
      child: AnimatedBuilder(
        animation: _themeController,
        builder: (context, _) {
          return MaterialApp(
            title: shellConfig.title,
            theme: _buildLightTheme(),
            darkTheme: _buildDarkTheme(),
            themeMode: _themeController.themeMode,
            localizationsDelegates: AppL10n.localizationsDelegates,
            supportedLocales: AppL10n.supportedLocales,
            onGenerateRoute: AppRouter.generateRoute,
            home: AuthGate(
              child: AppShell(
                initialPath: '/',
                routePageBuilder: buildBirdCoderRoutePageForPath,
                child: buildBirdCoderRoutePageForPath('/'),
              ),
            ),
          );
        },
      ),
    );
  }

  ThemeData _buildLightTheme() {
    return ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: Colors.blue,
        brightness: Brightness.light,
      ),
      useMaterial3: true,
    );
  }

  ThemeData _buildDarkTheme() {
    return ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: Colors.blue,
        brightness: Brightness.dark,
      ),
      useMaterial3: true,
    );
  }
}
