import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_host/sdkwork_birdcoder_flutter_mobile_host.dart';

import '../providers/app_provider.dart';
import 'auth_route.dart';

class _QrAuthorizationView {
  final String deviceAuthorizationId;
  final String? qrContent;
  final String? qrUrl;
  final String status;
  final bool sessionReady;

  const _QrAuthorizationView({
    required this.deviceAuthorizationId,
    this.qrContent,
    this.qrUrl,
    required this.status,
    this.sessionReady = false,
  });
}

class BirdCoderQrLoginPage extends StatefulWidget {
  final ValueChanged<BirdCoderAuthSurfaceRoute> onNavigate;

  const BirdCoderQrLoginPage({
    super.key,
    required this.onNavigate,
  });

  @override
  State<BirdCoderQrLoginPage> createState() => _BirdCoderQrLoginPageState();
}

class _BirdCoderQrLoginPageState extends State<BirdCoderQrLoginPage> {
  _QrAuthorizationView? _authorization;
  String? _pollSecret;
  String? _errorMessage;
  bool _loading = true;
  bool _exchanging = false;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_startQrLogin());
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  _QrAuthorizationView _toView(dynamic summary) {
    return _QrAuthorizationView(
      deviceAuthorizationId: summary.deviceAuthorizationId as String,
      qrContent: summary.qrContent as String?,
      qrUrl: summary.qrUrl as String?,
      status: summary.status as String,
      sessionReady: summary.sessionReady == true,
    );
  }

  Future<void> _startQrLogin() async {
    _pollTimer?.cancel();
    setState(() {
      _loading = true;
      _errorMessage = null;
      _authorization = null;
      _pollSecret = null;
      _exchanging = false;
    });

    final provider = AppProvider.of(context);
    try {
      final authorization = await birdCoderIamAuthService.createQrLoginAuthorization(
        apiBaseUrl: provider.apiBaseUrl,
        purpose: 'login',
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _authorization = _toView(authorization);
        _pollSecret = authorization.pollSecret?.trim();
        _loading = false;
      });
      _schedulePoll(authorization.deviceAuthorizationId);
    } on BirdCoderIamAuthException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _errorMessage = 'Unable to start QR sign-in.';
      });
    }
  }

  void _schedulePoll(String deviceAuthorizationId) {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      unawaited(_pollStatus(deviceAuthorizationId));
    });
  }

  bool _isConfirmedStatus(String status) {
    final normalized = status.trim().toLowerCase();
    return normalized == 'completed' || normalized == 'confirmed';
  }

  Future<void> _exchangeSession(String deviceAuthorizationId) async {
    final pollSecret = _pollSecret?.trim() ?? '';
    if (pollSecret.isEmpty) {
      setState(() {
        _errorMessage = 'QR sign-in is missing the poll secret required for session exchange.';
      });
      return;
    }

    final provider = AppProvider.of(context);
    setState(() {
      _exchanging = true;
      _errorMessage = null;
    });

    try {
      await birdCoderIamAuthService.exchangeQrLoginSession(
        apiBaseUrl: provider.apiBaseUrl,
        iamRuntime: provider.iamRuntime,
        deviceAuthorizationId: deviceAuthorizationId,
        pollSecret: pollSecret,
      );
    } on BirdCoderIamAuthException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _exchanging = false;
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _exchanging = false;
        _errorMessage = 'QR sign-in session exchange failed.';
      });
    }
  }

  Future<void> _pollStatus(String deviceAuthorizationId) async {
    if (_exchanging) {
      return;
    }

    final provider = AppProvider.of(context);
    try {
      final authorization = await birdCoderIamAuthService.retrieveQrLoginAuthorization(
        apiBaseUrl: provider.apiBaseUrl,
        deviceAuthorizationId: deviceAuthorizationId,
      );
      if (!mounted) {
        return;
      }

      final view = _toView(authorization);
      setState(() {
        _authorization = view;
      });

      if (_isConfirmedStatus(view.status) && view.sessionReady) {
        _pollTimer?.cancel();
        await _exchangeSession(deviceAuthorizationId);
        return;
      }

      final status = view.status.trim().toLowerCase();
      if (status == 'cancelled' || status == 'expired' || status == 'failed') {
        _pollTimer?.cancel();
        setState(() {
          _errorMessage = 'QR sign-in expired or was cancelled. Generate a new code.';
        });
      }
    } catch (_) {
      // Keep polling until the authorization expires or succeeds.
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: 16),
          Text('Preparing QR sign-in'),
        ],
      );
    }

    if (_errorMessage != null && _authorization == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'QR sign-in unavailable',
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            _errorMessage!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _startQrLogin,
            child: const Text('Try again'),
          ),
          TextButton(
            onPressed: () => widget.onNavigate(BirdCoderAuthSurfaceRoute.login),
            child: const Text('Back to password sign-in'),
          ),
        ],
      );
    }

    final authorization = _authorization;
    final qrContent = authorization?.qrContent?.trim();
    final qrUrl = authorization?.qrUrl?.trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Scan to sign in',
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        const Text(
          'Scan this authorization with an approved SDKWork sign-in client.',
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        if (qrContent != null && qrContent.isNotEmpty) ...[
          Center(child: BirdCoderQrPayloadView(payload: qrContent)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border.all(color: Theme.of(context).dividerColor),
              borderRadius: BorderRadius.circular(12),
            ),
            child: SelectableText(
              qrContent,
              style: const TextStyle(fontFamily: 'monospace'),
            ),
          ),
        ],
        if (qrUrl != null && qrUrl.isNotEmpty) ...[
          const SizedBox(height: 12),
          SelectableText(
            qrUrl,
            textAlign: TextAlign.center,
          ),
        ],
        if ((qrContent == null || qrContent.isEmpty) && (qrUrl == null || qrUrl.isEmpty))
          const Text(
            'QR payload was not returned by the authorization service.',
            textAlign: TextAlign.center,
          ),
        const SizedBox(height: 16),
        if (authorization != null)
          Text(
            'Status: ${authorization.status}',
            textAlign: TextAlign.center,
          ),
        if (_exchanging) ...[
          const SizedBox(height: 16),
          const Center(child: CircularProgressIndicator()),
          const SizedBox(height: 8),
          const Text(
            'Completing QR sign-in',
            textAlign: TextAlign.center,
          ),
        ],
        if (_errorMessage != null) ...[
          const SizedBox(height: 12),
          Text(
            _errorMessage!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
            textAlign: TextAlign.center,
          ),
        ],
        const SizedBox(height: 24),
        OutlinedButton(
          onPressed: qrContent == null || qrContent.isEmpty
              ? null
              : () => Clipboard.setData(ClipboardData(text: qrContent)),
          child: const Text('Copy QR payload'),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: _exchanging ? null : _startQrLogin,
          child: const Text('Refresh QR code'),
        ),
        TextButton(
          onPressed: () => widget.onNavigate(BirdCoderAuthSurfaceRoute.login),
          child: const Text('Use password sign-in'),
        ),
      ],
    );
  }
}
