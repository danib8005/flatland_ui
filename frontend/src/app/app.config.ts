import { ApplicationConfig, provideZoneChangeDetection, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withFetch()),
  ],
};
