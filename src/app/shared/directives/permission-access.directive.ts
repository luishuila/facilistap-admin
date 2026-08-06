import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, inject, OnDestroy } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { Subscription } from 'rxjs';

@Directive({
  selector: '[appPermissionAccess]',
  standalone: true,
})
export class PermissionAccessDirective implements OnInit, OnDestroy {
  private readonly templateRef = inject(TemplateRef<any>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authService = inject(AuthService);

  private hasView = false;
  private subscription?: Subscription;

  @Input('appPermissionAccess') set requiredPermissions(permissions: string[]) {
    this._requiredPermissions = permissions;
    this.updateView();
  }

  @Input('appPermissionAccessMode') mode: 'all' | 'any' = 'all';

  @Input('appPermissionAccessElse') elseTemplate?: TemplateRef<any>;

  private _requiredPermissions: string[] = [];

  ngOnInit(): void {
    this.subscription = this.authService.currentUser$.subscribe(() => {
      this.updateView();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private updateView(): void {
    let hasAccess = false;
    if (this.mode === 'any') {
      hasAccess = this._requiredPermissions.some((p) =>
        this.authService.hasPermission(p)
      );
    } else {
      hasAccess = this._requiredPermissions.every((p) =>
        this.authService.hasPermission(p)
      );
    }
    if (hasAccess && !this.hasView) {
      this.viewContainer.clear();
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasAccess) {
      this.viewContainer.clear();
      if (this.elseTemplate) {
        this.viewContainer.createEmbeddedView(this.elseTemplate);
      }
      this.hasView = false;
    }
  }
}
