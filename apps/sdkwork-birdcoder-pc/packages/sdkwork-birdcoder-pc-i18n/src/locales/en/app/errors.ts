import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('app/errors', {
  "app": {
    "somethingWentWrong": "Something went wrong",
    "unexpectedError": "An unexpected error occurred in the application. Please try refreshing the page.",
    "unexpectedErrorReload": "An unexpected error occurred. Please reload the application.",
    "reloadApplication": "Reload Application",
    "refresh": "Refresh"
  }
});
