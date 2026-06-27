import 'package:share_plus/share_plus.dart';

import 'native_service_error.dart';

/// Service contract for invoking the native share sheet.
///
/// Wraps the `share_plus` plugin behind a typed, testable interface so feature
/// widgets never import plugin classes directly. Implementations expose stable
/// [NativeServiceError] codes for availability and failure errors.
abstract class ShareService {
  static ShareService? _instance;

  /// Returns the shared [ShareService] singleton.
  factory ShareService() => _instance ??= ShareServiceImpl();

  /// Replaces the singleton, primarily for tests.
  static void bind(ShareService service) => _instance = service;

  /// Whether the share sheet is available on this device.
  Future<bool> isAvailable();

  /// Shares [text] with an optional [subject] through the native share sheet.
  ///
  /// Throws [NativeServiceException] with [NativeServiceError.unavailable]
  /// when no share target exists, or [NativeServiceError.failed] on other
  /// errors.
  Future<void> share({required String text, String? subject});

  /// Shares [paths] as files with optional accompanying [text].
  ///
  /// Throws [NativeServiceException] with [NativeServiceError.notFound] when
  /// a path cannot be resolved, or [NativeServiceError.failed] on other errors.
  Future<void> shareFiles({required List<String> paths, String? text});
}

class ShareServiceImpl implements ShareService {
  ShareServiceImpl();

  @override
  Future<bool> isAvailable() => Future.value(true);

  @override
  Future<void> share({required String text, String? subject}) async {
    try {
      await Share.share(text, subject: subject);
    } on Exception catch (error) {
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.toString(),
      );
    }
  }

  @override
  Future<void> shareFiles({required List<String> paths, String? text}) async {
    if (paths.isEmpty) {
      throw const NativeServiceException(NativeServiceError.invalidState);
    }
    try {
      final xFiles = paths.map((path) => XFile(path)).toList();
      await Share.shareXFiles(xFiles, text: text);
    } on Exception catch (error) {
      final message = error.toString();
      if (message.contains('not found') || message.contains('does not exist')) {
        throw NativeServiceException(
          NativeServiceError.notFound,
          platformMessage: message,
        );
      }
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: message,
      );
    }
  }
}
