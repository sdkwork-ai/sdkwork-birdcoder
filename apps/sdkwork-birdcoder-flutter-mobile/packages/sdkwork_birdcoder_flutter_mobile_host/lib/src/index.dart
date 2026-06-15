library sdkwork_birdcoder_flutter_mobile_host;

const String kFlutterMobileHostVersion = '0.1.0';

class HostPlatform {
  final String name;
  final bool isNative;

  const HostPlatform({
    required this.name,
    required this.isNative,
  });

  static HostPlatform detect() {
    // Platform detection would use platform channels in production
    return const HostPlatform(name: 'unknown', isNative: false);
  }
}
