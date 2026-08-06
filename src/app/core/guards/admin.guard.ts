import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    void router.navigate(['/auth/login']);
    return false;
  }

  if (authService.hasRole('ADMIN')) {
    return true;
  }

  void router.navigate(['/dashboard']);
  return false;
};
