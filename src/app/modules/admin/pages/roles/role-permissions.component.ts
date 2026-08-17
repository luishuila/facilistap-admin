import {
  Component,
  OnInit,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { finalize } from 'rxjs';

import { RoleService } from '../../services/role.service';
import { PermissionService } from '../../services/permission.service';
import { Role } from '../../../../core/models/role.interface';
import { Permission } from '../../../../core/models/permission.interface';

export interface RolePermissionsDialogData {
  role: Role;
}

interface PermissionGroup {
  module: string;
  permissions: Permission[];
  expanded: boolean;
}

@Component({
  selector: 'app-role-permissions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatChipsModule,
  ],
  template: `
    <div class="permissions-dialog">
      <div class="dialog-header">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>security</mat-icon>
          </div>
          <div class="header-text">
            <h2 class="dialog-title">Permisos del Rol</h2>
            <p class="dialog-subtitle">
              Gestione los permisos para <strong>{{ data.role.name }}</strong>
            </p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        @if (loading()) {
          <div class="loading-container">
            <mat-spinner diameter="40" color="primary"></mat-spinner>
            <p>Cargando permisos...</p>
          </div>
        } @else {
          <div class="permissions-toolbar">
            <div class="permissions-count">
              <mat-chip color="primary" highlighted>
                {{ selectedPermissionIds.size }} / {{ allPermissions().length }} seleccionados
              </mat-chip>
            </div>
            <div class="permissions-actions">
              <button mat-button color="primary" (click)="selectAll()">
                <mat-icon>select_all</mat-icon>
                Seleccionar todos
              </button>
              <button mat-button color="warn" (click)="deselectAll()">
                <mat-icon>deselect</mat-icon>
                Deseleccionar todos
              </button>
            </div>
          </div>

          <mat-accordion class="permissions-accordion" multi>
            @for (group of permissionGroups(); track group.module) {
              <mat-expansion-panel [expanded]="group.expanded">
                <mat-expansion-panel-header>
                  <mat-panel-title>
                    <mat-icon class="module-icon">folder</mat-icon>
                    <span class="module-name">{{ formatModuleName(group.module) }}</span>
                    <mat-chip class="module-count" disableRipple>
                      {{ countSelectedInGroup(group) }} / {{ group.permissions.length }}
                    </mat-chip>
                  </mat-panel-title>
                </mat-expansion-panel-header>

                <div class="permission-items">
                  @for (permission of group.permissions; track permission.id) {
                    <div class="permission-item">
                      <mat-checkbox
                        [checked]="selectedPermissionIds.has(permission.id)"
                        (change)="togglePermission(permission.id, $event.checked)"
                        [color]="'primary'"
                      >
                        <div class="permission-info">
                          <span class="permission-name">{{ permission.name }}</span>
                          @if (permission.description) {
                            <span class="permission-description">{{ permission.description }}</span>
                          }
                        </div>
                      </mat-checkbox>
                    </div>
                  }
                </div>
              </mat-expansion-panel>
            }
          </mat-accordion>
        }
      </div>

      <div class="dialog-actions">
        <button mat-stroked-button (click)="onCancel()" [disabled]="saving()">
          Cancelar
        </button>
        <button mat-flat-button color="primary" (click)="onSave()" [disabled]="saving() || loading()">
          @if (saving()) {
            <mat-spinner diameter="20" color="accent"></mat-spinner>
          } @else {
            <mat-icon>save</mat-icon>
          }
          <span>Guardar Permisos</span>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .permissions-dialog {
        display: flex;
        flex-direction: column;
        max-height: 75vh;
        padding: 8px;
      }

      .dialog-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        padding: 0 8px 16px;
        flex-shrink: 0;
      }

      .header-content {
        display: flex;
        align-items: flex-start;
        gap: 16px;
      }

      .header-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        display: flex;
        align-items: center;
        justify-content: center;

        mat-icon {
          color: #fff;
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      .header-text {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .dialog-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #1e293b;
      }

      .dialog-subtitle {
        margin: 0;
        font-size: 13px;
        color: #64748b;
      }

      .close-btn {
        color: #94a3b8;
      }

      .dialog-body {
        padding: 8px;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
      }

      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 16px;
        gap: 16px;
        color: #64748b;
      }

      .permissions-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0 16px;
        flex-wrap: wrap;
        gap: 8px;
      }

      .permissions-count {
        display: flex;
        align-items: center;
      }

      .permissions-actions {
        display: flex;
        gap: 4px;
      }

      .permissions-accordion {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .module-icon {
        color: #64748b;
        margin-right: 8px;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .module-name {
        font-weight: 600;
        font-size: 14px;
        text-transform: capitalize;
        flex: 1;
      }

      .module-count {
        font-size: 11px;
        height: 22px;
        padding: 0 10px;
        border-radius: 11px;
        background: #f1f5f9;
      }

      .permission-items {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 0;
      }

      .permission-item {
        padding: 4px 0;
        border-bottom: 1px solid #f8fafc;

        &:last-child {
          border-bottom: none;
        }
      }

      .permission-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .permission-name {
        font-size: 14px;
        font-weight: 500;
        color: #334155;
      }

      .permission-description {
        font-size: 12px;
        color: #94a3b8;
      }

      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 8px 4px;
        flex-shrink: 0;
        border-top: 1px solid #f1f5f9;
        margin-top: 8px;

        button {
          border-radius: 8px;
          padding: 0 24px;
          font-weight: 500;
          height: 44px;
        }

        button[mat-flat-button] {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }
    `,
  ],
})
export class RolePermissionsComponent implements OnInit {
  protected readonly data: RolePermissionsDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<RolePermissionsComponent>);
  private readonly roleService = inject(RoleService);
  private readonly permissionService = inject(PermissionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly allPermissions = signal<Permission[]>([]);
  protected readonly permissionGroups = signal<PermissionGroup[]>([]);
  protected readonly selectedPermissionIds = new Set<number>();
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.permissionService
      .getAll({ limit: 1000 })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (res) => {
          this.allPermissions.set(res.items);
          this.groupPermissions(res.items);
          this.loadRolePermissions();
        },
        error: () => {
          this.snackBar.open('Error al cargar permisos', 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  private loadRolePermissions(): void {
    this.roleService
      .getPermissions(this.data.role.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.selectedPermissionIds.clear();
          (res.data ?? []).forEach((perm: any) => this.selectedPermissionIds.add(perm.id));
        },
        error: () => {
          this.snackBar.open('Error al cargar permisos del rol', 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  private groupPermissions(permissions: Permission[]): void {
    const groups: PermissionGroup[] = [];
    const moduleMap = new Map<string, Permission[]>();

    permissions.forEach((perm) => {
      const module = perm.module || 'General';
      if (!moduleMap.has(module)) {
        moduleMap.set(module, []);
      }
      moduleMap.get(module)!.push(perm);
    });

    moduleMap.forEach((perms, module) => {
      groups.push({
        module,
        permissions: perms,
        expanded: true,
      });
    });

    groups.sort((a, b) => a.module.localeCompare(b.module));
    this.permissionGroups.set(groups);
  }

  protected formatModuleName(module: string): string {
    return module
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  protected togglePermission(permissionId: number, checked: boolean): void {
    if (checked) {
      this.selectedPermissionIds.add(permissionId);
    } else {
      this.selectedPermissionIds.delete(permissionId);
    }
  }

  protected selectAll(): void {
    this.allPermissions().forEach((perm) => this.selectedPermissionIds.add(perm.id));
  }

  protected deselectAll(): void {
    this.selectedPermissionIds.clear();
  }

  protected countSelectedInGroup(group: PermissionGroup): number {
    return group.permissions.filter((p) => this.selectedPermissionIds.has(p.id)).length;
  }

  protected onSave(): void {
    if (this.saving()) return;

    this.saving.set(true);
    const permissionIds = Array.from(this.selectedPermissionIds);

    this.roleService
      .setPermissions(this.data.role.id, permissionIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Permisos guardados correctamente', 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-success',
          });
          this.saving.set(false);
          this.dialogRef.close(true);
        },
        error: () => {
          this.snackBar.open('Error al guardar permisos', 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
          this.saving.set(false);
        },
      });
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
