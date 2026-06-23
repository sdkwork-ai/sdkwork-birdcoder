import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_host/sdkwork_birdcoder_flutter_mobile_host.dart';

import '../providers/app_provider.dart';
import 'auth_dev_prefill.dart';
import 'auth_route.dart';

class BirdCoderLoginPage extends StatefulWidget {
  final ValueChanged<BirdCoderAuthSurfaceRoute> onNavigate;

  const BirdCoderLoginPage({
    super.key,
    required this.onNavigate,
  });

  @override
  State<BirdCoderLoginPage> createState() => _BirdCoderLoginPageState();
}

class _BirdCoderLoginPageState extends State<BirdCoderLoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _submitting = false;
  bool _loadingOAuthProviders = true;
  String? _errorMessage;
  bool _oauthLoginEnabled = false;
  List<String> _oauthProviders = const [];
  String? _activeOAuthProvider;
  bool _runtimeSettingsRequested = false;

  @override
  void initState() {
    super.initState();
    final prefill = BirdCoderAuthDevPrefill.resolve();
    if (prefill.enabled) {
      if (prefill.account != null) {
        _usernameController.text = prefill.account!;
      }
      if (prefill.password != null) {
        _passwordController.text = prefill.password!;
      }
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_runtimeSettingsRequested) {
      return;
    }
    _runtimeSettingsRequested = true;
    _loadRuntimeSettings();
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _loadRuntimeSettings() async {
    final provider = AppProvider.of(context);

    try {
      final settings = await birdCoderIamAuthService.fetchIamRuntimeSettings(
        apiBaseUrl: provider.apiBaseUrl,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _oauthLoginEnabled = settings.oauthLoginEnabled;
        _oauthProviders = settings.oauthProviders
            .map((provider) => provider.trim())
            .where((provider) => provider.isNotEmpty)
            .toList();
      });
    } catch (_) {
      // OAuth providers are optional; password login remains available.
    } finally {
      if (mounted) {
        setState(() {
          _loadingOAuthProviders = false;
        });
      }
    }
  }

  Future<void> _handleSubmit() async {
    if (_submitting || !_formKey.currentState!.validate()) {
      return;
    }

    final provider = AppProvider.of(context);
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });

    try {
      await birdCoderIamAuthService.signInWithPassword(
        apiBaseUrl: provider.apiBaseUrl,
        iamRuntime: provider.iamRuntime,
        username: _usernameController.text,
        password: _passwordController.text,
      );
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
        _errorMessage = 'Sign-in failed. Check your account and try again.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Future<void> _handleOAuthSignIn(String providerName) async {
    if (_submitting || _activeOAuthProvider != null) {
      return;
    }

    final provider = AppProvider.of(context);
    setState(() {
      _activeOAuthProvider = providerName;
      _errorMessage = null;
    });

    try {
      final authUrl = await birdCoderIamAuthService.resolveOAuthAuthorizationUrl(
        apiBaseUrl: provider.apiBaseUrl,
        provider: providerName,
        redirectUri: buildBirdCoderOAuthCallbackReturnUrl(provider: providerName),
      );
      final launched = await launchBirdCoderExternalAuthUrl(authUrl);
      if (!launched && mounted) {
        setState(() {
          _errorMessage = 'Unable to open the OAuth provider. Check your device browser settings.';
        });
      }
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
        _errorMessage = 'OAuth sign-in failed. Try again or use password login.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _activeOAuthProvider = null;
        });
      }
    }
  }

  List<String> get _visibleOAuthProviders {
    if (!_oauthLoginEnabled) {
      return const [];
    }
    return _oauthProviders;
  }

  @override
  Widget build(BuildContext context) {
    final oauthProviders = _visibleOAuthProviders;

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Sign in to BirdCoder',
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _usernameController,
            decoration: const InputDecoration(
              labelText: 'Account',
              border: OutlineInputBorder(),
            ),
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.username],
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Account is required';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _passwordController,
            decoration: const InputDecoration(
              labelText: 'Password',
              border: OutlineInputBorder(),
            ),
            obscureText: true,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.password],
            onFieldSubmitted: (_) => _handleSubmit(),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Password is required';
              }
              return null;
            },
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _submitting ? null : _handleSubmit,
            child: _submitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Sign in'),
          ),
          if (_loadingOAuthProviders) ...[
            const SizedBox(height: 16),
            const Center(
              child: SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          ],
          if (!_loadingOAuthProviders && oauthProviders.isNotEmpty) ...[
            const SizedBox(height: 24),
            const Divider(),
            const SizedBox(height: 16),
            Text(
              'Or continue with',
              style: Theme.of(context).textTheme.titleSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            for (final providerName in oauthProviders) ...[
              OutlinedButton(
                onPressed: _activeOAuthProvider == null ? () => _handleOAuthSignIn(providerName) : null,
                child: _activeOAuthProvider == providerName
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text('Continue with $providerName'),
              ),
              const SizedBox(height: 8),
            ],
          ],
          const SizedBox(height: 16),
          TextButton(
            onPressed: () => widget.onNavigate(BirdCoderAuthSurfaceRoute.register),
            child: const Text('Create account'),
          ),
          TextButton(
            onPressed: () => widget.onNavigate(BirdCoderAuthSurfaceRoute.recovery),
            child: const Text('Forgot password'),
          ),
          TextButton(
            onPressed: () => widget.onNavigate(BirdCoderAuthSurfaceRoute.qr),
            child: const Text('Sign in with QR code'),
          ),
        ],
      ),
    );
  }
}
