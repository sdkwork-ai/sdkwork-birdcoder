class HostAdapters {
  final bool cameraAvailable;
  final bool qrScannerAvailable;
  final bool pushNotificationsAvailable;
  final bool deepLinksAvailable;
  final bool secureStorageAvailable;
  final bool biometricAvailable;
  final bool clipboardAvailable;
  final bool filePickerAvailable;

  HostAdapters({
    this.cameraAvailable = false,
    this.qrScannerAvailable = false,
    this.pushNotificationsAvailable = false,
    this.deepLinksAvailable = false,
    this.secureStorageAvailable = false,
    this.biometricAvailable = false,
    this.clipboardAvailable = false,
    this.filePickerAvailable = false,
  });

  static HostAdapters create() {
    // Typed platform adapters for camera, QR, push, deep links, secure storage, biometric, etc.
    // Platform channels and plugin calls stay behind typed platform adapters
    return HostAdapters();
  }
}
