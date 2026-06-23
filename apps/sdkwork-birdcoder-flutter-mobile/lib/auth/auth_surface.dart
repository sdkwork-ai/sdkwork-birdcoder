import 'package:flutter/material.dart';

import 'auth_route.dart';
import 'login_page.dart';
import 'oauth_callback_page.dart';
import 'qr_login_page.dart';
import 'recovery_page.dart';
import 'register_page.dart';

class BirdCoderAuthSurface extends StatefulWidget {
  final VoidCallback? onClose;
  final BirdCoderAuthSurfaceRoute initialRoute;
  final BirdCoderOAuthCallbackQuery? oauthCallbackQuery;

  const BirdCoderAuthSurface({
    super.key,
    this.onClose,
    this.initialRoute = BirdCoderAuthSurfaceRoute.login,
    this.oauthCallbackQuery,
  });

  @override
  State<BirdCoderAuthSurface> createState() => _BirdCoderAuthSurfaceState();
}

class _BirdCoderAuthSurfaceState extends State<BirdCoderAuthSurface> {
  late BirdCoderAuthSurfaceRoute _route;

  @override
  void initState() {
    super.initState();
    _route = widget.initialRoute;
  }

  void _navigate(BirdCoderAuthSurfaceRoute route) {
    setState(() {
      _route = route;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SDKWork IAM'),
        leading: widget.onClose == null
            ? null
            : IconButton(
                icon: const Icon(Icons.close),
                onPressed: widget.onClose,
              ),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: switch (_route) {
              BirdCoderAuthSurfaceRoute.login => BirdCoderLoginPage(
                  onNavigate: _navigate,
                ),
              BirdCoderAuthSurfaceRoute.register => BirdCoderRegisterPage(
                  onNavigate: _navigate,
                ),
              BirdCoderAuthSurfaceRoute.recovery => BirdCoderRecoveryPage(
                  onNavigate: _navigate,
                ),
              BirdCoderAuthSurfaceRoute.qr => BirdCoderQrLoginPage(
                  onNavigate: _navigate,
                ),
              BirdCoderAuthSurfaceRoute.oauthCallback => BirdCoderOAuthCallbackPage(
                  query: widget.oauthCallbackQuery ?? const BirdCoderOAuthCallbackQuery(),
                  onNavigate: _navigate,
                ),
            },
          ),
        ),
      ),
    );
  }
}
