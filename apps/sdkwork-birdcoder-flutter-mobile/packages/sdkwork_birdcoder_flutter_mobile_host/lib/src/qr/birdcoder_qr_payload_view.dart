import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

class BirdCoderQrPayloadView extends StatelessWidget {
  final String payload;
  final double size;

  const BirdCoderQrPayloadView({
    super.key,
    required this.payload,
    this.size = 240,
  });

  @override
  Widget build(BuildContext context) {
    final normalized = payload.trim();
    if (normalized.isEmpty) {
      return const SizedBox.shrink();
    }

    return Semantics(
      label: 'QR sign-in code',
      child: QrImageView(
        data: normalized,
        size: size,
        backgroundColor: Colors.white,
        eyeStyle: const QrEyeStyle(
          eyeShape: QrEyeShape.square,
          color: Color(0xFF111827),
        ),
        dataModuleStyle: const QrDataModuleStyle(
          dataModuleShape: QrDataModuleShape.square,
          color: Color(0xFF111827),
        ),
      ),
    );
  }
}
