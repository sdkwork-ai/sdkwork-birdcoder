import 'package:file_picker/file_picker.dart';
import 'package:flutter/services.dart';

import 'native_service_error.dart';

/// Result of a file pick request.
class FilePickResult {
  const FilePickResult({
    required this.path,
    required this.name,
    this.size,
    this.bytes,
  });

  /// Absolute path to the picked file (null on web).
  final String? path;

  /// Display name of the picked file.
  final String name;

  /// Size in bytes, when reported by the platform.
  final int? size;

  /// Raw bytes for the picked file, populated on web where no path exists.
  final List<int>? bytes;
}

/// Service contract for selecting files from device storage.
///
/// Wraps the `file_picker` plugin behind a typed, testable interface so
/// feature widgets never import plugin classes directly. Implementations
/// expose stable [NativeServiceError] codes for permission, availability, and
/// cancellation errors.
abstract class FilePickerService {
  static FilePickerService? _instance;

  /// Returns the shared [FilePickerService] singleton.
  factory FilePickerService() => _instance ??= FilePickerServiceImpl();

  /// Replaces the singleton, primarily for tests.
  static void bind(FilePickerService service) => _instance = service;

  /// Whether file selection is supported on this device.
  Future<bool> isAvailable();

  /// Picks a single file matching [type] and optional [allowedExtensions].
  ///
  /// Throws [NativeServiceException] with [NativeServiceError.permissionDenied]
  /// when access is denied, [NativeServiceError.cancelled] when the user
  /// dismisses the picker, or [NativeServiceError.failed] on other errors.
  Future<FilePickResult> pickFile({
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    bool withData = false,
  });

  /// Picks multiple files matching [type] and optional [allowedExtensions].
  Future<List<FilePickResult>> pickFiles({
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    bool allowMultiple = true,
    bool withData = false,
  });
}

class FilePickerServiceImpl implements FilePickerService {
  FilePickerServiceImpl();

  @override
  Future<bool> isAvailable() => Future.value(true);

  @override
  Future<FilePickResult> pickFile({
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    bool withData = false,
  }) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: type,
        allowedExtensions: allowedExtensions,
        withData: withData,
      );
      if (result == null || result.files.isEmpty) {
        throw const NativeServiceException(NativeServiceError.cancelled);
      }
      final file = result.files.first;
      return FilePickResult(
        path: file.path,
        name: file.name,
        size: file.size,
        bytes: file.bytes,
      );
    } on PlatformException catch (error) {
      if (error.code.contains('permission') || error.code.contains('denied')) {
        throw NativeServiceException(
          NativeServiceError.permissionDenied,
          platformMessage: error.code,
        );
      }
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.code,
      );
    } on NativeServiceException {
      rethrow;
    } on Exception catch (error) {
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.toString(),
      );
    }
  }

  @override
  Future<List<FilePickResult>> pickFiles({
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    bool allowMultiple = true,
    bool withData = false,
  }) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: type,
        allowedExtensions: allowedExtensions,
        allowMultiple: allowMultiple,
        withData: withData,
      );
      if (result == null || result.files.isEmpty) {
        throw const NativeServiceException(NativeServiceError.cancelled);
      }
      return result.files
          .map((file) => FilePickResult(
                path: file.path,
                name: file.name,
                size: file.size,
                bytes: file.bytes,
              ))
          .toList();
    } on PlatformException catch (error) {
      if (error.code.contains('permission') || error.code.contains('denied')) {
        throw NativeServiceException(
          NativeServiceError.permissionDenied,
          platformMessage: error.code,
        );
      }
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.code,
      );
    } on NativeServiceException {
      rethrow;
    } on Exception catch (error) {
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.toString(),
      );
    }
  }
}
