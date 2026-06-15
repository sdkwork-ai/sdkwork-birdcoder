library sdkwork_birdcoder_flutter_mobile_commons;

const String kFlutterMobileCommonsVersion = '0.1.0';

class CommonsUtils {
  static String formatDate(DateTime date) {
    return date.toIso8601String();
  }

  static String formatNumber(num number) {
    return number.toString();
  }
}
