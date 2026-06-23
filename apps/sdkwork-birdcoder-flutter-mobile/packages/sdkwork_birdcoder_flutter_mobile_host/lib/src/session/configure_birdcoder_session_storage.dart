import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'birdcoder_session_storage.dart';

const _iosSecureStorageOptions = IOSOptions(
  accessibility: KeychainAccessibility.first_unlock_this_device,
);

const _androidSecureStorageOptions = AndroidOptions(
  encryptedSharedPreferences: true,
);

Future<void> configureDefaultBirdCoderSessionStorage() async {
  if (kIsWeb) {
    bindBirdCoderSessionStorage(MemoryBirdCoderSessionStorage());
    return;
  }

  const secureStorage = FlutterSecureStorage(
    aOptions: _androidSecureStorageOptions,
    iOptions: _iosSecureStorageOptions,
  );

  bindBirdCoderSessionStorage(
    PersistedBirdCoderSessionStorage(
      readValue: (key) => secureStorage.read(key: key),
      writeValue: (key, value) => secureStorage.write(key: key, value: value),
      deleteValue: (key) => secureStorage.delete(key: key),
    ),
  );
}
