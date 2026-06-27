import 'package:url_launcher/url_launcher.dart';

import 'native_service_error.dart';

/// Launch mode for opening a URL.
enum BirdCoderLaunchMode {
  /// Platform default (browser on most platforms).
  externalApplication,

  /// In-app webview, when supported.
  inAppBrowser,

  /// Platform-specific custom tab.
  platformDefault,
}

/// Service contract for opening URLs through the native platform handler.
///
/// Wraps the `url_launcher` plugin behind a typed, testable interface so
/// feature widgets never import plugin classes directly. Implementations
/// expose stable [NativeServiceError] codes for malformed URLs and launch
/// failures.
abstract class UrlLauncherService {
  static UrlLauncherService? _instance;

  /// Returns the shared [UrlLauncherService] singleton.
  factory UrlLauncherService() => _instance ??= UrlLauncherServiceImpl();

  /// Replaces the singleton, primarily for tests.
  static void bind(UrlLauncherService service) => _instance = service;

  /// Whether the platform can launch [url].
  Future<bool> canLaunch(String url);

  /// Launches [url] in the requested [mode].
  ///
  /// Throws [NativeServiceException] with [NativeServiceError.invalidState]
  /// when [url] is not a valid URI, [NativeServiceError.unavailable] when no
  /// handler can open it, or [NativeServiceError.failed] on other errors.
  Future<void> launch(String url,
      {BirdCoderLaunchMode mode = BirdCoderLaunchMode.externalApplication});
}

class UrlLauncherServiceImpl implements UrlLauncherService {
  UrlLauncherServiceImpl();

  @override
  Future<bool> canLaunch(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      return false;
    }
    try {
      return await canLaunchUrl(uri);
    } on Exception {
      return false;
    }
  }

  @override
  Future<void> launch(String url,
      {BirdCoderLaunchMode mode = BirdCoderLaunchMode.externalApplication}) async {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      throw const NativeServiceException(NativeServiceError.invalidState);
    }

    final launchMode = switch (mode) {
      BirdCoderLaunchMode.externalApplication =>
        LaunchMode.externalApplication,
      BirdCoderLaunchMode.inAppBrowser => LaunchMode.inAppBrowserView,
      BirdCoderLaunchMode.platformDefault => LaunchMode.platformDefault,
    };

    try {
      final ok = await launchUrl(uri, mode: launchMode);
      if (!ok) {
        throw const NativeServiceException(NativeServiceError.unavailable);
      }
    } on NativeServiceException {
      rethrow;
    } on ArgumentError catch (error) {
      throw NativeServiceException(
        NativeServiceError.invalidState,
        platformMessage: error.toString(),
      );
    } on Exception catch (error) {
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.toString(),
      );
    }
  }
}
