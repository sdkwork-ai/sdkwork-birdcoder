import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_shell/sdkwork_birdcoder_flutter_mobile_shell.dart';

import '../auth_gate.dart';

class AppShell extends StatefulWidget {
  final BirdCoderFlutterBootstrapState bootstrapState;
  final Widget child;

  const AppShell({
    super.key,
    required this.bootstrapState,
    required this.child,
  });

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final shellConfig = ShellConfig.defaultConfig();

    return Scaffold(
      appBar: AppBar(
        title: Text(shellConfig.title),
        actions: [
          IconButton(
            tooltip: 'Sign in',
            onPressed: () => openBirdCoderAuthSurface(context),
            icon: const Icon(Icons.login),
          ),
        ],
      ),
      body: widget.child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) => setState(() => _selectedIndex = index),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.chat),
            label: 'Chat',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}
