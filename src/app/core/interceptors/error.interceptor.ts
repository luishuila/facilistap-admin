import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiResponse } from '../models/api-response.interface';

const ERROR_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check your input.',
  401: 'Your session has expired. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  422: 'Validation failed. Please check the submitted data.',
  500: 'An internal server error occurred. Please try again later.',
};

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = ERROR_MESSAGES[error.status] ?? 'An unexpected error occurred.';

      if (error.error && typeof error.error === 'object') {
        const apiError = error.error as Record<string, unknown>;
        if (typeof apiError['message'] === 'string') {
          message = apiError['message'] as string;
        }
      }

      console.error(`[HTTP ${error.status}] ${req.method} ${req.url}`, message, error);
      return throwError(() => new Error(message));
    })
  );
};
