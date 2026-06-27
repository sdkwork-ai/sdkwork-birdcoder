import '../l10n/l10n.dart';

/// Stable error codes for native capability services.
///
/// Services throw [NativeServiceException] carrying one of these codes so the
/// UI layer can render localized messages through [localizeNativeServiceError]
/// without coupling services to a [BuildContext].
enum NativeServiceError {
  unsupported,
  permissionDenied,
  unavailable,
  cancelled,
  invalidState,
  timeout,
  notFound,
  failed,
}

/// Exception thrown by native capability services.
///
/// Carries a stable [code] and an optional platform message for diagnostics.
class NativeServiceException implements Exception {
  const NativeServiceException(this.code, {this.platformMessage});

  final NativeServiceError code;
  final String? platformMessage;

  @override
  String toString() {
    final message = platformMessage;
    return message == null
        ? 'NativeServiceException($code)'
        : 'NativeServiceException($code: $message)';
  }
}

/// Resolves a localized user-facing message for [error] using [l10n].
///
/// Services stay free of [BuildContext] by throwing [NativeServiceException];
/// the UI layer calls this helper to render the translated string.
String localizeNativeServiceError(AppLocalizations l10n, NativeServiceError error) {
  switch (error) {
    case NativeServiceError.unsupported:
      return l10n.native_error_unsupported;
    case NativeServiceError.permissionDenied:
      return l10n.native_error_permission_denied;
    case NativeServiceError.unavailable:
      return l10n.native_error_unavailable;
    case NativeServiceError.cancelled:
      return l10n.native_error_cancelled;
    case NativeServiceError.invalidState:
      return l10n.native_error_invalid_state;
    case NativeServiceError.timeout:
      return l10n.native_error_timeout;
    case NativeServiceError.notFound:
      return l10n.native_error_not_found;
    case NativeServiceError.failed:
      return l10n.native_error_failed;
  }
}
