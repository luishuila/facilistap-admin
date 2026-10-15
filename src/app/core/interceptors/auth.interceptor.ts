import { HttpRequest, HttpHandlerFn, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { throwError, Subject, Observable } from 'rxjs';
import { catchError, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Agrega el token y, cuando el backend responde 401 (el access token dura 30 min),
 * lo renueva una sola vez con el refresh token (dura 7 dias) y repite la peticion.
 * En withInterceptors va DESPUES de errorInterceptor (mas cerca del backend): asi recibe
 * el HttpErrorResponse original con su `status` antes de que errorInterceptor lo convierta.
 */
let refreshInFlight: Subject<string | null> | null = null;

const SKIP_URLS = ['/auth/login', '/auth/refresh', '/auth/logout'];

/** 403 del backend cuando la IP no esta en la lista de IPs permitidas del panel. */
function isIpBlocked(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403) return false;
  const msg = (error.error as { message?: unknown } | null)?.message;
  return typeof msg === 'string' && msg.startsWith('Acceso no autorizado');
}

export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (req.url.includes('/auth/login') || req.url.includes('/auth/refresh')) {
    return next(req);
  }
  // Solo las peticiones a nuestro backend llevan el token. Subidas directas a S3 con URL
  // firmada (u otros dominios) fallan si se les agrega un Authorization extra.
  if (!req.url.startsWith(environment.apiUrl.replace(/\/$/, ''))) {
    return next(req);
  }

  const token = authService.getToken();
  // Peticiones que ya traen su propio Authorization (p. ej. cerrar la sesion recien creada) no se tocan.
  if (token && !req.headers.has('Authorization')) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(req).pipe(
    catchError((error: unknown) => {
      // La IP dejo de estar permitida (o cambio de red): se cierra la sesion local.
      if (token && isIpBlocked(error)) {
        authService.endLocalSession();
        void router.navigate(['/auth/login'], { queryParams: { ip: 1 } });
        return throwError(() => error);
      }
      const is401 = error instanceof HttpErrorResponse && error.status === 401;
      if (is401 && token && !SKIP_URLS.some((u) => req.url.includes(u))) {
        return retryWithFreshToken(req, next, authService, router);
      }
      return throwError(() => error);
    }),
  );
}

function retryWithFreshToken(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router,
): Observable<HttpEvent<unknown>> {
  // Si ya hay una renovacion en curso, esperar su resultado en vez de lanzar otra.
  if (!refreshInFlight) {
    const inFlight = new Subject<string | null>();
    refreshInFlight = inFlight;

    authService.refreshToken().subscribe({
      next: (response) => {
        const newToken = response.data?.access_token ?? null;
        refreshInFlight = null;
        inFlight.next(newToken);
        inFlight.complete();
      },
      error: () => {
        refreshInFlight = null;
        inFlight.next(null);
        inFlight.complete();
      },
    });
  }

  return refreshInFlight.pipe(
    take(1),
    switchMap((newToken) => {
      if (!newToken) {
        // Refresh vencido o revocado (cerrado desde otro dispositivo, usuario bloqueado...):
        // se limpia la sesion local sin llamar al backend y se vuelve al login.
        authService.endLocalSession();
        void router.navigate(['/auth/login'], { queryParams: { expired: 1 } });
        return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Session expired', url: req.url }));
      }
      return next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }));
    }),
  );
}
