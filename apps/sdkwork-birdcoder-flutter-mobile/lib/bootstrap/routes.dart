class AppRoutes {
  static List<String> create() {
    // Route assembly follows FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md
    // Route ids align with PC/H5 via APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md
    // Route id format: <surface>.<domain>.<capability>.<screen>
    return [
      'app.iam.login.index',
      'app.chat.index',
    ];
  }
}
