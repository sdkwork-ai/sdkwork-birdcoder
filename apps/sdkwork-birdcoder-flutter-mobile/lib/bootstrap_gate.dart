import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';

class BootstrapGate extends StatefulWidget {
  final Future<BirdCoderFlutterBootstrapState> Function() bootstrap;
  final Widget Function(BirdCoderFlutterBootstrapState bootstrapState) builder;

  const BootstrapGate({
    super.key,
    required this.bootstrap,
    required this.builder,
  });

  @override
  State<BootstrapGate> createState() => _BootstrapGateState();
}

class _BootstrapGateState extends State<BootstrapGate> {
  late final Future<BirdCoderFlutterBootstrapState> _bootstrapFuture;

  @override
  void initState() {
    super.initState();
    _bootstrapFuture = widget.bootstrap();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<BirdCoderFlutterBootstrapState>(
      future: _bootstrapFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const MaterialApp(
            home: Scaffold(
              body: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(),
                    SizedBox(height: 16),
                    Text('Starting BirdCoder runtime'),
                  ],
                ),
              ),
            ),
          );
        }

        if (snapshot.hasError) {
          return MaterialApp(
            home: Scaffold(
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    snapshot.error.toString(),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            ),
          );
        }

        final bootstrapState = snapshot.data;
        if (bootstrapState == null) {
          return const MaterialApp(
            home: Scaffold(
              body: Center(child: Text('BirdCoder bootstrap returned no state')),
            ),
          );
        }

        return widget.builder(bootstrapState);
      },
    );
  }
}
