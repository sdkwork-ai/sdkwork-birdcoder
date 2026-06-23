import 'dart:convert';

import 'birdcoder_session_record.dart';

const birdCoderAuthSessionKey = 'sdkwork.birdcoder.appSession.v1';

abstract class BirdCoderSessionStorage {
  Future<BirdCoderSessionRecord?> read();

  Future<void> write(BirdCoderSessionRecord record);

  Future<void> clear();
}

class MemoryBirdCoderSessionStorage implements BirdCoderSessionStorage {
  BirdCoderSessionRecord? _record;

  @override
  Future<void> clear() async {
    _record = null;
  }

  @override
  Future<BirdCoderSessionRecord?> read() async {
    return _record;
  }

  @override
  Future<void> write(BirdCoderSessionRecord record) async {
    _record = record;
  }
}

class PersistedBirdCoderSessionStorage implements BirdCoderSessionStorage {
  PersistedBirdCoderSessionStorage({
    required Future<String?> Function(String key) readValue,
    required Future<void> Function(String key, String value) writeValue,
    required Future<void> Function(String key) deleteValue,
    this.storageKey = birdCoderAuthSessionKey,
  })  : _readValue = readValue,
        _writeValue = writeValue,
        _deleteValue = deleteValue;

  final Future<String?> Function(String key) _readValue;
  final Future<void> Function(String key, String value) _writeValue;
  final Future<void> Function(String key) _deleteValue;
  final String storageKey;

  @override
  Future<void> clear() async {
    await _deleteValue(storageKey);
  }

  @override
  Future<BirdCoderSessionRecord?> read() async {
    final raw = await _readValue(storageKey);
    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      return BirdCoderSessionRecord.fromJson(jsonDecode(raw));
    } catch (_) {
      await clear();
      return null;
    }
  }

  @override
  Future<void> write(BirdCoderSessionRecord record) async {
    await _writeValue(storageKey, jsonEncode(record.toJson()));
  }
}

BirdCoderSessionStorage _defaultSessionStorage = MemoryBirdCoderSessionStorage();

BirdCoderSessionStorage getBirdCoderSessionStorage() {
  return _defaultSessionStorage;
}

void bindBirdCoderSessionStorage(BirdCoderSessionStorage storage) {
  _defaultSessionStorage = storage;
}
