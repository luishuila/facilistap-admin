import {
  Component,
  OnInit,
  inject,
  signal,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FormControl } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';

import { ProviderService } from '../../services/provider.service';
import { CategoryService } from '../../services/category.service';
import { UserService } from '../../services/user.service';
import { User } from '../../../../core/models/user.interface';
import { Provider } from '../../../../core/models/provider.interface';
import { Category, localizedText } from '../../../../core/models/category.interface';

export interface ProviderFormData {
  provider?: Provider;
}

@Component({
  selector: 'app-provider-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatAutocompleteModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './provider-form.component.html',
  styleUrls: ['./provider-form.component.scss'],
})
export class ProviderFormComponent implements OnInit {
  private readonly dialogRef = inject<
    MatDialogRef<ProviderFormComponent, boolean>
  >(MatDialogRef<ProviderFormComponent, boolean>);
  private readonly data = inject<ProviderFormData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly fb = inject(FormBuilder);
  private readonly providerService = inject(ProviderService);
  private readonly categoryService = inject(CategoryService);
  private readonly userService = inject(UserService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form: FormGroup;
  protected readonly isEdit: boolean;
  protected readonly categories = signal<Category[]>([]);
  protected readonly categoryName = localizedText;
  /** Dueño del negocio (usuario de la app): solo al crear. */
  protected readonly ownerSearch = new FormControl<string | User>('', { nonNullable: true });
  protected readonly owner = signal<User | null>(null);
  protected readonly ownerOptions = signal<User[]>([]);
  protected readonly ownerLabel = (u: User | string | null): string =>
    !u ? '' : typeof u === 'string' ? u : `${u.name ?? ''} ${u.lastname ?? ''}`.trim() + (u.email ? ` · ${u.email}` : '');

  /** Dueño en modo edición: "Nombre (@usuario)". */
  protected get ownerDisplay(): string {
    const p = this.data?.provider;
    if (!p?.ownerName && !p?.ownerUsername) return 'Sin dueño asignado';
    return [p.ownerName, p.ownerUsername ? '@' + p.ownerUsername : ''].filter(Boolean).join('  ');
  }

  protected get ownerEmail(): string {
    return this.data?.provider?.ownerEmail ?? '';
  }

  constructor() {
    const provider = this.data?.provider;
    this.isEdit = !!provider;

    this.form = this.fb.group({
      name: [provider?.name ?? '', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
      username: [provider?.username ?? '', [Validators.required, Validators.maxLength(30)]],
      email: [provider?.email ?? '', [Validators.required, Validators.email]],
      phone: [provider?.phone ?? '', [Validators.required, Validators.pattern(/^\d{7,25}$/)]],
      description: [provider?.description ?? ''],
      categories: [provider?.categories ?? [], [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.categoryService
      .getAll({ page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.categories.set(res?.items ?? []),
        error: () => this.snackBar.open('Error al cargar categorías', 'Cerrar', { duration: 5000 }),
      });

    if (this.isEdit) return;
    this.ownerSearch.valueChanges
      .pipe(
        map((v) => {
          if (typeof v !== 'string') return null;
          this.owner.set(null);
          return v.trim();
        }),
        filter((v): v is string => v !== null),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) =>
          term.length < 2
            ? of([])
            : this.userService.getAll({ page: 1, limit: 10, search: term }).pipe(
                map((res) => res.items ?? []),
                catchError(() => of([])),
              ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((users) => this.ownerOptions.set(users));
  }

  protected selectOwner(u: User): void {
    this.owner.set(u);
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting) return;
    if (!this.isEdit && !this.owner()) {
      this.snackBar.open('Elija el dueño del negocio (un usuario de la app).', 'Cerrar', { duration: 4000 });
      return;
    }
    this._submitting = true;

    const value = this.form.value;
    const categoryIds: number[] = (value.categories ?? []).map((id: unknown) => Number(id));

    const payload: Record<string, unknown> = {
      name: value.name?.trim(),
      username: value.username?.trim(),
      email: value.email?.trim(),
      phone: value.phone?.trim(),
      description: value.description?.trim() || undefined,
      categories: categoryIds,
    };

    if (!this.isEdit) {
      // El backend exige el dueño: un usuario de la app (la cuenta del panel no es usuario de la app).
      payload['userId'] = this.owner()!.id;
    }

    const request$ = this.isEdit
      ? this.providerService.update(this.data.provider!.id, payload)
      : this.providerService.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackBar.open(
          this.isEdit ? 'Proveedor actualizado correctamente' : 'Proveedor creado correctamente',
          'Cerrar',
          { duration: 3000 },
        );
        this.dialogRef.close(true);
      },
      error: (err: Error) => {
        this._submitting = false;
        this.snackBar.open(err?.message || 'Error al guardar el proveedor', 'Cerrar', { duration: 5000 });
      },
    });
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }

  private _submitting = false;

  protected get submitting(): boolean {
    return this._submitting;
  }
}
