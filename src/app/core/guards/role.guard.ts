import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return (_route, _state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      void router.navigate(['/auth/login']);
      return false;
    }

    const hasAllowedRole = allowedRoles.some((role) => authService.hasRole(role));
    if (hasAllowedRole) {
      return true;
    }

    void router.navigate(['/dashboard']);
    return false;
  };
}
