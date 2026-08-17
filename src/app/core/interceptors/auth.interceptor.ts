import { HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const authService = inject(AuthService);

  if (req.url.includes('/auth/login') || req.url.includes('/auth/refresh')) {
    return next(req);
  }

  const token = authService.getToken();

  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && token && !req.url.includes('/auth/refresh')) {
        return handle401(req, next, authService);
      }
      return throwError(() => error);
    })
  );
}

function handle401(req: HttpRequest<unknown>, next: HttpHandlerFn, authService: AuthService) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((response) => {
        isRefreshing = false;
        const newToken = response.data?.access_token ?? '';
        if (newToken) {
          refreshTokenSubject.next(newToken);
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }));
        }
        return throwError(() => new Error('No token in refresh response'));
      }),
      catchError((err) => {
        isRefreshing = false;
        authService.logout().subscribe();
        return throwError(() => err);
      })
    );
  }

  return refreshTokenSubject.pipe(
    filter((t) => t !== null),
    take(1),
    switchMap((t) => next(req.clone({ setHeaders: { Authorization: `Bearer ${t}` } })))
  );
}
