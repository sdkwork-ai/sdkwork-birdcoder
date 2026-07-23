import 'dart:async';

import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';

import '../providers/app_provider.dart';
import 'auth_route.dart';

class BirdCoderOAuthCallbackPage extends StatefulWidget {
  final BirdCoderOAuthCallbackQuery query;
  final ValueChanged<BirdCoderAuthSurfaceRoute> onNavigate;

  const BirdCoderOAuthCallbackPage({
    super.key,
    required this.query,
    required this.onNavigate,
  });

  @override
  State<BirdCoderOAuthCallbackPage> createState() =>
      _BirdCoderOAuthCallbackPageState();
}

class _BirdCoderOAuthCallbackPageState
    extends State<BirdCoderOAuthCallbackPage> {
  String? _errorMessage;
  bool _completed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_completeCallback());
    });
  }

  Future<void> _completeCallback() async {
    final error = widget.query.error?.trim();
    if (error != null && error.isNotEmpty) {
      setState(() {
        _errorMessage = widget.query.errorDescription?.trim().isNotEmpty == true
            ? widget.query.errorDescription!.trim()
            : 'OAuth sign-in was cancelled or denied.';
      });
      return;
    }

    final code = widget.query.code?.trim() ?? '';
    final provider = widget.query.provider?.trim() ?? '';
    if (code.isEmpty || provider.isEmpty) {
      setState(() {
        _errorMessage = 'OAuth callback is missing authorization parameters.';
      });
      return;
    }

    final providerState = AppProvider.of(context);
    try {
      await providerState.iamAuthService.completeOAuthCallback(
        iamRuntime: providerState.iamRuntime,
        code: code,
        provider: provider,
        state: widget.query.state,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _completed = true;
      });
    } on BirdCoderIamAuthException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _errorMessage =
            'OAuth sign-in failed. Try again or use password login.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_completed) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Signed in successfully',
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          const Text(
            'Your SDKWork session is active.',
            textAlign: TextAlign.center,
          ),
        ],
      );
    }

    if (_errorMessage != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'OAuth sign-in failed',
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
            onPressed: () => widget.onNavigate(BirdCoderAuthSurfaceRoute.login),
            child: const Text('Back to sign in'),
          ),
        ],
      );
    }

    return const Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircularProgressIndicator(),
        SizedBox(height: 16),
        Text('Completing OAuth sign-in'),
      ],
    );
  }
}
