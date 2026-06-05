import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Lyne Web Components - Side-Effect Imports
import '@sbb-esta/lyne-elements/button/button.js';
import '@sbb-esta/lyne-elements/button/secondary-button.js';
import '@sbb-esta/lyne-elements/button/transparent-button.js';
import '@sbb-esta/lyne-elements/button/mini-button.js';
import '@sbb-esta/lyne-elements/divider.js';
import '@sbb-esta/lyne-elements/tag.js';
import '@sbb-esta/lyne-elements/loading-indicator.js';
import '@sbb-esta/lyne-elements/loading-indicator-circle.js';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
