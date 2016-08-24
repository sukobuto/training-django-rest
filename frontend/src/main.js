import 'babel-polyfill';
// import 'fetch';
import environment from './environment';

//Configure Bluebird Promises.
//Note: You may want to use environment-specific configuration.
// Promise.config({
//   warnings: {
//     wForgottenReturn: false
//   }
// });


export async function configure(aurelia) {
  aurelia.use
    .standardConfiguration()
    .feature('resources')
    .plugin('aurelia-dialog', settings => {
      settings.startingZIndex = 1111;
    });

  if (environment.debug) {
    aurelia.use.developmentLogging();
  }

  if (environment.testing) {
    aurelia.use.plugin('aurelia-testing');
  }

  await aurelia.start();
  aurelia.setRoot();
}
