import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';

import '../auth/auth_route.dart';
import '../auth/auth_surface.dart';

class AppRouter {
  static Route<dynamic> generateRoute(RouteSettings settings) {
    final routeName = settings.name ?? '/';

    if (isBirdCoderAuthRoutePath(routeName)) {
      return MaterialPageRoute(
        builder: (_) => BirdCoderAuthSurface(
          initialRoute: resolveBirdCoderAuthSurfaceRoute(routeName),
          oauthCallbackQuery: resolveBirdCoderAuthSurfaceRoute(routeName) ==
                  BirdCoderAuthSurfaceRoute.oauthCallback
              ? parseBirdCoderOAuthCallbackQuery(routeName)
              : null,
        ),
        settings: settings,
      );
    }

    switch (routeName) {
      case '/':
        return MaterialPageRoute(
          builder: (_) => const Scaffold(
            body: Center(child: Text('Chat Page')),
          ),
          settings: settings,
        );
      case '/settings':
        return MaterialPageRoute(
          builder: (_) => const Scaffold(
            body: Center(child: Text('Settings Page')),
          ),
          settings: settings,
        );
      default:
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            body: Center(
              child: Text('Unknown route: $routeName'),
            ),
          ),
          settings: settings,
        );
    }
  }
}
