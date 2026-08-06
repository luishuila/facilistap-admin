import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { CategoryService } from '../category.service';
import { Category } from '../../../core/models/category.interface';

export interface CategoryFormData {
  category?: Category;
}

interface MaterialIcon {
  name: string;
  label: string;
}

@Component({
  selector: 'app-category-form',
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
  templateUrl: './category-form.component.html',
  styleUrls: ['./category-form.component.scss'],
})
export class CategoryFormComponent implements OnInit {
  private readonly dialogRef = inject<
    MatDialogRef<CategoryFormComponent, boolean>
  >(MatDialogRef<CategoryFormComponent, boolean>);
  private readonly data = inject<CategoryFormData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly form: FormGroup;
  protected readonly isEdit: boolean;
  protected readonly availableIcons: MaterialIcon[] = [
    { name: 'category', label: 'Categoría' },
    { name: 'restaurant', label: 'Restaurante' },
    { name: 'shopping_cart', label: 'Compras' },
    { name: 'local_grocery_store', label: 'Mercado' },
    { name: 'local_bar', label: 'Bar' },
    { name: 'local_cafe', label: 'Cafetería' },
    { name: 'local_pizza', label: 'Pizzería' },
    { name: 'fastfood', label: 'Comida rápida' },
    { name: 'bakery_dining', label: 'Panadería' },
    { name: 'liquor', label: 'Licores' },
    { name: 'local_pharmacy', label: 'Farmacia' },
    { name: 'local_hospital', label: 'Salud' },
    { name: 'fitness_center', label: 'Fitness' },
    { name: 'pets', label: 'Mascotas' },
    { name: 'checkroom', label: 'Ropa' },
    { name: 'hardware', label: 'Ferretería' },
    { name: 'build', label: 'Construcción' },
    { name: 'directions_car', label: 'Automotriz' },
    { name: 'devices', label: 'Electrónica' },
    { name: 'toys', label: 'Juguetes' },
    { name: 'menu_book', label: 'Libros' },
    { name: 'sports_esports', label: 'Deportes' },
    { name: 'music_note', label: 'Música' },
    { name: 'movie', label: 'Entretenimiento' },
  ];

  constructor() {
    const category = this.data?.category;
    this.isEdit = !!category;

    this.form = this.fb.group({
      name: [category?.name ?? '', [Validators.required, Validators.maxLength(100)]],
      description: [category?.description ?? ''],
      icon: [category?.icon ?? ''],
    });
  }

  ngOnInit(): void {}

  protected onSubmit(): void {
    if (this.form.invalid || this._submitting) {
      return;
    }

    this._submitting = true;

    const formValue = {
      name: this.form.value.name?.trim(),
      description: this.form.value.description?.trim() || '',
      icon: this.form.value.icon || null,
    };

    const request$ = this.isEdit
      ? this.categoryService.update(this.data!.category!.id, formValue)
      : this.categoryService.create(formValue);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEdit
            ? 'Categoría actualizada correctamente'
            : 'Categoría creada correctamente',
          'Cerrar',
          { duration: 3000 }
        );
        this.dialogRef.close(true);
      },
      error: () => {
        this._submitting = false;
        this.snackBar.open(
          'Error al guardar la categoría',
          'Cerrar',
          { duration: 5000 }
        );
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
