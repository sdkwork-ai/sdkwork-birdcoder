import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';

import '../auth/auth_route.dart';
import '../auth/auth_surface.dart';
import '../routing/route_page_factory.dart';

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
      builder: (_) => buildBirdCoderRoutePageForPath(routeName),
      settings: settings,
    );
  }
}
