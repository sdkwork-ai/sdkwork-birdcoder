import 'package:flutter/material.dart';

class AuthGate extends StatelessWidget {
  final Widget child;

  const AuthGate({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    // Auth gate follows APP_SDK_INTEGRATION_SPEC.md
    // Appbase IAM runtime owns login/session/refresh/logout
    return child;
  }
}
