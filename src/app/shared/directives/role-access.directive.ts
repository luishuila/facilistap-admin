import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, inject, OnDestroy } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { Subscription } from 'rxjs';

@Directive({
  selector: '[appRoleAccess]',
  standalone: true,
})
export class RoleAccessDirective implements OnInit, OnDestroy {
  private readonly templateRef = inject(TemplateRef<any>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authService = inject(AuthService);

  private hasView = false;
  private subscription?: Subscription;

  @Input('appRoleAccess') set allowedRoles(roles: string[]) {
    this._allowedRoles = roles;
    this.updateView();
  }

  @Input('appRoleAccessElse') elseTemplate?: TemplateRef<any>;

  private _allowedRoles: string[] = [];

  ngOnInit(): void {
    this.subscription = this.authService.currentUser.subscribe(() => {
      this.updateView();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private updateView(): void {
    const hasAccess = this.authService.hasRole(this._allowedRoles);
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
