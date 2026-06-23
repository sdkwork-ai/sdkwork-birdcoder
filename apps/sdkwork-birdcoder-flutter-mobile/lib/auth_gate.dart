import 'dart:async';

import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_host/sdkwork_birdcoder_flutter_mobile_host.dart';

import 'auth/auth_route.dart';
import 'auth/auth_surface.dart';
import 'providers/app_provider.dart';

class AuthGate extends StatefulWidget {
  final Widget child;

  const AuthGate({super.key, required this.child});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _showAuthSurface = false;
  String? _deepLinkAuthPath;
  StreamSubscription<Uri>? _deepLinkSubscription;
  final _deepLinks = getBirdCoderDeepLinkAdapter();

  @override
  void initState() {
    super.initState();
    _deepLinkSubscription = _deepLinks.watchUriLinks().listen(_handleDeepLinkUri);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_bootstrapDeepLinks());
    });
  }

  @override
  void dispose() {
    _deepLinkSubscription?.cancel();
    super.dispose();
  }

  Future<void> _bootstrapDeepLinks() async {
    final initialUri = await _deepLinks.readInitialUri();
    _handleDeepLinkUri(initialUri);
  }

  void _handleDeepLinkUri(Uri? uri) {
    final authPath = normalizeBirdCoderAuthDeepLinkPath(uri);
    if (authPath == null || !mounted) {
      return;
    }

    setState(() {
      _deepLinkAuthPath = authPath;
      _showAuthSurface = true;
    });
  }

  BirdCoderAuthSurfaceRoute _resolveAuthSurfaceRoute() {
    return resolveBirdCoderAuthSurfaceRoute(_deepLinkAuthPath);
  }

  BirdCoderOAuthCallbackQuery? _resolveOAuthCallbackQuery() {
    if (_resolveAuthSurfaceRoute() != BirdCoderAuthSurfaceRoute.oauthCallback) {
      return null;
    }
    return parseBirdCoderOAuthCallbackQuery(_deepLinkAuthPath);
  }

  @override
  Widget build(BuildContext context) {
    final provider = AppProvider.of(context);
    final iamRuntime = provider.iamRuntime;
    final bootAuthPath = shouldBootIntoAuthSurface(_deepLinkAuthPath)
        ? _deepLinkAuthPath
        : null;

    return ListenableBuilder(
      listenable: iamRuntime,
      builder: (context, _) {
        if (!iamRuntime.initialized) {
          return const Scaffold(
            body: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Validating SDKWork session'),
                ],
              ),
            ),
          );
        }

        final shouldShowAuthSurface =
            _showAuthSurface || !iamRuntime.sessionValidated || bootAuthPath != null;

        if (shouldShowAuthSurface) {
          return BirdCoderAuthSurface(
            initialRoute: resolveBirdCoderAuthSurfaceRoute(bootAuthPath ?? _deepLinkAuthPath),
            oauthCallbackQuery: _resolveOAuthCallbackQuery(),
            onClose: iamRuntime.sessionValidated
                ? () => setState(() {
                      _showAuthSurface = false;
                      _deepLinkAuthPath = null;
                    })
                : null,
          );
        }

        return _AuthGateScope(
          openAuthSurface: () => setState(() => _showAuthSurface = true),
          child: widget.child,
        );
      },
    );
  }
}

class _AuthGateScope extends InheritedWidget {
  final VoidCallback openAuthSurface;

  const _AuthGateScope({
    required this.openAuthSurface,
    required super.child,
  });

  static _AuthGateScope? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<_AuthGateScope>();
  }

  @override
  bool updateShouldNotify(_AuthGateScope oldWidget) => false;
}

void openBirdCoderAuthSurface(BuildContext context) {
  _AuthGateScope.maybeOf(context)?.openAuthSurface();
}

bool shouldBootIntoAuthSurface(String? initialRoute) {
  if (initialRoute == null || initialRoute.isEmpty) {
    return false;
  }
  return isBirdCoderAuthRoutePath(initialRoute);
}
