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
  static const _tabPaths = ['/', '/settings'];

  int _selectedIndex = 0;

  void _openTab(int index) {
    if (index < 0 || index >= _tabPaths.length) {
      return;
    }

    setState(() => _selectedIndex = index);
    Navigator.of(context).pushReplacementNamed(_tabPaths[index]);
  }

  @override
  Widget build(BuildContext context) {
    final shellConfig = ShellConfig.defaultConfig();
    final routeName = ModalRoute.of(context)?.settings.name ?? '/';
    final selectedIndex = _tabPaths.indexOf(routeName);
    if (selectedIndex >= 0 && selectedIndex != _selectedIndex) {
      _selectedIndex = selectedIndex;
    }

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
        onTap: _openTab,
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
