import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';

import '../providers/app_provider.dart';
import 'auth_route.dart';

class BirdCoderRecoveryPage extends StatefulWidget {
  final ValueChanged<BirdCoderAuthSurfaceRoute> onNavigate;

  const BirdCoderRecoveryPage({
    super.key,
    required this.onNavigate,
  });

  @override
  State<BirdCoderRecoveryPage> createState() => _BirdCoderRecoveryPageState();
}

class _BirdCoderRecoveryPageState extends State<BirdCoderRecoveryPage> {
  final _formKey = GlobalKey<FormState>();
  final _accountController = TextEditingController();
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _submitting = false;
  bool _codeRequested = false;
  String? _errorMessage;
  String? _successMessage;

  @override
  void dispose() {
    _accountController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleRequestCode() async {
    if (_submitting || _accountController.text.trim().isEmpty) {
      setState(() {
        _errorMessage = 'Account is required.';
      });
      return;
    }

    final provider = AppProvider.of(context);
    setState(() {
      _submitting = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      await birdCoderIamAuthService.requestPasswordReset(
        apiBaseUrl: provider.apiBaseUrl,
        account: _accountController.text,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _codeRequested = true;
        _successMessage = 'Verification code sent. Enter the code to reset your password.';
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
        _errorMessage = 'Unable to request a verification code right now.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Future<void> _handleResetPassword() async {
    if (_submitting || !_formKey.currentState!.validate()) {
      return;
    }

    final provider = AppProvider.of(context);
    setState(() {
      _submitting = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      await birdCoderIamAuthService.resetPassword(
        apiBaseUrl: provider.apiBaseUrl,
        account: _accountController.text,
        code: _codeController.text,
        newPassword: _passwordController.text,
        confirmPassword: _confirmPasswordController.text,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _successMessage = 'Password reset complete. Sign in with your new password.';
      });
      widget.onNavigate(BirdCoderAuthSurfaceRoute.login);
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
        _errorMessage = 'Password reset failed. Check the code and try again.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Reset your password',
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _accountController,
            decoration: const InputDecoration(
              labelText: 'Account',
              border: OutlineInputBorder(),
            ),
            textInputAction: TextInputAction.next,
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Account is required';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          if (_codeRequested) ...[
            TextFormField(
              controller: _codeController,
              decoration: const InputDecoration(
                labelText: 'Verification code',
                border: OutlineInputBorder(),
              ),
              textInputAction: TextInputAction.next,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Verification code is required';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _passwordController,
              decoration: const InputDecoration(
                labelText: 'New password',
                border: OutlineInputBorder(),
              ),
              obscureText: true,
              textInputAction: TextInputAction.next,
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'New password is required';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _confirmPasswordController,
              decoration: const InputDecoration(
                labelText: 'Confirm new password',
                border: OutlineInputBorder(),
              ),
              obscureText: true,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _handleResetPassword(),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Confirm password is required';
                }
                if (value != _passwordController.text) {
                  return 'Passwords do not match';
                }
                return null;
              },
            ),
          ],
          if (_errorMessage != null) ...[
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          if (_successMessage != null) ...[
            const SizedBox(height: 16),
            Text(
              _successMessage!,
              style: TextStyle(color: Theme.of(context).colorScheme.primary),
            ),
          ],
          const SizedBox(height: 24),
          if (!_codeRequested)
            FilledButton(
              onPressed: _submitting ? null : _handleRequestCode,
              child: _submitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Send verification code'),
            )
          else
            FilledButton(
              onPressed: _submitting ? null : _handleResetPassword,
              child: _submitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Reset password'),
            ),
          const SizedBox(height: 16),
          TextButton(
            onPressed: () => widget.onNavigate(BirdCoderAuthSurfaceRoute.login),
            child: const Text('Back to sign in'),
          ),
        ],
      ),
    );
  }
}
