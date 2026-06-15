import 'package:flutter/material.dart';
import 'auth_gate.dart';

class BirdcoderApp extends StatelessWidget {
  const BirdcoderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SDKWork BirdCoder',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: AuthGate(
        child: const Scaffold(
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('SDKWork BirdCoder Flutter Mobile'),
                SizedBox(height: 16),
                Text('Coming soon'),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
