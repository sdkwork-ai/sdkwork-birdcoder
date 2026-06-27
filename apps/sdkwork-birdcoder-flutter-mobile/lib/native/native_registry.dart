/// Unified access point for BirdCoder native capability services.
///
/// Importing `package:sdkwork_birdcoder_flutter_mobile/native/native_registry.dart`
/// gives feature widgets a single, well-typed handle to every native capability
/// the app exposes. Each service is a process-wide singleton whose concrete
/// implementation can be swapped at runtime through `Service.bind(...)` for
/// tests. The registry itself never instantiates services eagerly; it simply
/// forwards to each service's `factory` constructor, so the first access pays
/// the construction cost.
///
/// Services throw [NativeServiceException] (see `native_service_error.dart`)
/// carrying a stable [NativeServiceError] code. Call
/// [localizeNativeServiceError] from the UI layer to render a translated
/// message without coupling widgets to platform-specific error strings.
library;

import 'camera_service.dart';
import 'connectivity_service.dart';
import 'device_info_service.dart';
import 'file_picker_service.dart';
import 'http_service.dart';
import 'image_picker_service.dart';
import 'local_auth_service.dart';
import 'native_service_error.dart';
import 'package_info_service.dart';
import 'path_provider_service.dart';
import 'permission_service.dart';
import 'secure_storage_service.dart';
import 'share_service.dart';
import 'url_launcher_service.dart';

export 'camera_service.dart';
export 'connectivity_service.dart';
export 'device_info_service.dart';
export 'file_picker_service.dart';
export 'http_service.dart';
export 'image_picker_service.dart';
export 'local_auth_service.dart';
export 'native_service_error.dart';
export 'package_info_service.dart';
export 'path_provider_service.dart';
export 'permission_service.dart';
export 'secure_storage_service.dart';
export 'share_service.dart';
export 'url_launcher_service.dart';

/// Process-wide registry of native capability singletons.
///
/// Use [camera], [imagePicker], etc. to obtain the active implementation.
/// Call the corresponding `Service.bind(...)` to inject mocks in tests.
class NativeRegistry {
  NativeRegistry._();

  /// Camera capture.
  static CameraService get camera => CameraService();

  /// Image picking (camera or gallery).
  static ImagePickerService get imagePicker => ImagePickerService();

  /// File picking.
  static FilePickerService get filePicker => FilePickerService();

  /// Native share sheet.
  static ShareService get share => ShareService();

  /// URL launcher.
  static UrlLauncherService get urlLauncher => UrlLauncherService();

  /// Biometric / device credential authentication.
  static LocalAuthService get localAuth => LocalAuthService();

  /// Network connectivity observer.
  static ConnectivityService get connectivity => ConnectivityService();

  /// Application package metadata.
  static PackageInfoService get packageInfo => PackageInfoService();

  /// Device hardware / OS metadata.
  static DeviceInfoService get deviceInfo => DeviceInfoService();

  /// Runtime permission management.
  static PermissionService get permission => PermissionService();

  /// Platform file system directories.
  static PathProviderService get pathProvider => PathProviderService();

  /// HTTP client.
  static HttpService get http => HttpService();

  /// Encrypted key-value storage.
  static SecureStorageService get secureStorage => SecureStorageService();
}
