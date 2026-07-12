import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';

import '../auth/auth_route.dart';
import '../auth/auth_surface.dart';
import '../auth_gate.dart';
import '../routing/route_page_factory.dart';
import '../shell/app_shell.dart';

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

    return MaterialPageRoute(
      builder: (_) => AuthGate(
        child: AppShell(
          initialPath: routeName,
          routePageBuilder: buildBirdCoderRoutePageForPath,
          child: buildBirdCoderRoutePageForPath(routeName),
        ),
      ),
      settings: settings,
    );
  }
}
