import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { SubcategoryService } from '../subcategory.service';
import { CategoryService } from '../../categories/category.service';
import { Subcategory } from '../../../core/models/subcategory.interface';
import { Category } from '../../../core/models/category.interface';

export interface SubcategoryFormData {
  subcategory?: Subcategory;
}

@Component({
  selector: 'app-subcategory-form',
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './subcategory-form.component.html',
  styleUrls: ['./subcategory-form.component.scss'],
})
export class SubcategoryFormComponent implements OnInit {
  private readonly dialogRef = inject<
    MatDialogRef<SubcategoryFormComponent, boolean>
  >(MatDialogRef<SubcategoryFormComponent, boolean>);
  private readonly data =
    inject<SubcategoryFormData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly fb = inject(FormBuilder);
  private readonly subcategoryService = inject(SubcategoryService);
  private readonly categoryService = inject(CategoryService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly form: FormGroup;
  protected readonly isEdit: boolean;
  protected readonly categories = signal<Category[]>([]);

  constructor() {
    const subcategory = this.data?.subcategory;
    this.isEdit = !!subcategory;

    this.form = this.fb.group({
      name: [
        subcategory?.name ?? '',
        [Validators.required, Validators.maxLength(100)],
      ],
      description: [subcategory?.description ?? ''],
      categoryId: [
        subcategory?.categoryId ?? '',
        [Validators.required],
      ],
    });
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  private loadCategories(): void {
    this.categoryService
      .getAll({ page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' })
      .subscribe({
        next: (res) => {
          this.categories.set(res.items);
        },
        error: () => {
          this.snackBar.open('Error al cargar categorías', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }

  protected onSubmit(): void {
    if (this.form.invalid || this._submitting) {
      this.form.markAllAsTouched();
      return;
    }

    this._submitting = true;

    const formValue = {
      name: this.form.value.name?.trim(),
      description: this.form.value.description?.trim() || '',
      categoryId: this.form.value.categoryId,
    };

    const request$ = this.isEdit
      ? this.subcategoryService.update(this.data!.subcategory!.id, formValue)
      : this.subcategoryService.create(formValue);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEdit
            ? 'Subcategoría actualizada correctamente'
            : 'Subcategoría creada correctamente',
          'Cerrar',
          { duration: 3000 }
        );
        this.dialogRef.close(true);
      },
      error: () => {
        this._submitting = false;
        this.snackBar.open('Error al guardar la subcategoría', 'Cerrar', {
          duration: 5000,
        });
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
