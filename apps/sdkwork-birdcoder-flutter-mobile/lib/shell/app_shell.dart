import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_shell/sdkwork_birdcoder_flutter_mobile_shell.dart';

import '../auth_gate.dart';

class AppShell extends StatefulWidget {
  final Widget child;
  final String initialPath;
  final Widget Function(String path)? routePageBuilder;

  const AppShell({
    super.key,
    required this.child,
    this.initialPath = '/',
    this.routePageBuilder,
  });

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  static const _tabPaths = ['/', '/settings'];

  late String _activePath;
  late int _selectedIndex;
  late final Map<String, Widget> _pages;

  @override
  void initState() {
    super.initState();
    _activePath = widget.initialPath;
    _selectedIndex = _tabIndexForPath(_activePath);
    _pages = <String, Widget>{_activePath: widget.child};
  }

  @override
  void didUpdateWidget(covariant AppShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialPath != widget.initialPath) {
      _activePath = widget.initialPath;
      _selectedIndex = _tabIndexForPath(_activePath);
      _pages[_activePath] ??= widget.child;
    }
  }

  int _tabIndexForPath(String path) {
    final index = _tabPaths.indexOf(path);
    return index < 0 ? 0 : index;
  }

  void _openTab(int index) {
    if (index < 0 || index >= _tabPaths.length) {
      return;
    }

    final path = _tabPaths[index];
    setState(() {
      _selectedIndex = index;
      _activePath = path;
      _pages.putIfAbsent(
        path,
        () => widget.routePageBuilder?.call(path) ?? widget.child,
      );
    });
  }

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
      body: _pages[_activePath] ?? widget.child,
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
