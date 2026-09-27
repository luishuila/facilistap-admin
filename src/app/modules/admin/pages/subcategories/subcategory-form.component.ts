import {
  Component,
  DestroyRef,
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
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap } from 'rxjs';

import { SubcategoryService } from '../../services/subcategory.service';
import { CategoryService } from '../../services/category.service';
import { Subcategory, SubcategoryPayload } from '../../../../core/models/subcategory.interface';
import {
  Category,
  CategoryLang,
  CATEGORY_LANGS,
  LocalizedText,
  localizedText,
} from '../../../../core/models/category.interface';

export interface SubcategoryFormData {
  subcategory?: Subcategory;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
    MatTabsModule,
    MatSlideToggleModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './subcategory-form.component.html',
  // Mismos estilos que el formulario de categoría (imagen + pestañas ES/EN)
  styleUrls: ['../categories/category-form.component.scss', './subcategory-form.component.scss'],
})
export class SubcategoryFormComponent implements OnInit {
  protected readonly categoryName = localizedText;

  private readonly dialogRef = inject<
    MatDialogRef<SubcategoryFormComponent, boolean>
  >(MatDialogRef<SubcategoryFormComponent, boolean>);
  private readonly data =
    inject<SubcategoryFormData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly fb = inject(FormBuilder);
  private readonly subcategoryService = inject(SubcategoryService);
  private readonly categoryService = inject(CategoryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly langs = CATEGORY_LANGS;
  protected readonly acceptedTypes = ALLOWED_IMAGE_TYPES.join(',');
  protected readonly form: FormGroup;
  protected readonly isEdit: boolean;
  protected readonly categories = signal<Category[]>([]);

  /** URL ya guardada en S3 (o null si no tiene / se quitó). */
  protected readonly imageUrl = signal<string | null>(null);
  /** Archivo elegido que aún no se ha subido; se sube al guardar. */
  private pendingFile: File | null = null;
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly dragOver = signal(false);
  protected readonly submitting = signal(false);

  constructor() {
    const subcategory = this.data?.subcategory;
    this.isEdit = !!subcategory;
    this.imageUrl.set(subcategory?.img ?? null);
    this.previewUrl.set(subcategory?.img ?? null);

    this.form = this.fb.group({
      name: this.fb.group({
        es: [subcategory?.name?.es ?? '', [Validators.required, Validators.maxLength(100)]],
        en: [subcategory?.name?.en ?? '', [Validators.maxLength(100)]],
      }),
      description: this.fb.group({
        es: [subcategory?.description?.es ?? '', [Validators.maxLength(1000)]],
        en: [subcategory?.description?.en ?? '', [Validators.maxLength(1000)]],
      }),
      categoryId: [subcategory?.categoryId ?? null, [Validators.required]],
      isAssete: [subcategory?.isActive ?? true],
    });

    this.destroyRef.onDestroy(() => this.revokePreview());
  }

  ngOnInit(): void {
    this.categoryService
      .getAll({ page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.categories.set(res?.items ?? []),
        error: () => {
          this.snackBar.open('Error al cargar categorías', 'Cerrar', { duration: 5000 });
        },
      });
  }

  protected nameControl(lang: CategoryLang) {
    return this.form.get(['name', lang])!;
  }

  protected descriptionControl(lang: CategoryLang) {
    return this.form.get(['description', lang])!;
  }

  protected langHasError(lang: CategoryLang): boolean {
    const name = this.nameControl(lang);
    const desc = this.descriptionControl(lang);
    return (name.invalid && name.touched) || (desc.invalid && desc.touched);
  }

  // ── Imagen ────────────────────────────────────────────────

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setFile(input.files?.[0] ?? null);
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    this.setFile(event.dataTransfer?.files?.[0] ?? null);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected removeImage(): void {
    this.revokePreview();
    this.pendingFile = null;
    this.imageUrl.set(null);
    this.previewUrl.set(null);
  }

  private setFile(file: File | null): void {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.snackBar.open('Formato no permitido. Use JPG, PNG, WEBP o GIF', 'Cerrar', { duration: 4000 });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.snackBar.open('La imagen supera 5 MB', 'Cerrar', { duration: 4000 });
      return;
    }
    this.revokePreview();
    this.pendingFile = file;
    this.previewUrl.set(URL.createObjectURL(file));
  }

  private revokePreview(): void {
    const url = this.previewUrl();
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  // ── Guardar ───────────────────────────────────────────────

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.submitting()) return;
    this.submitting.set(true);

    // Se usa el mismo flujo de subida a S3 que las categorías
    const image$: Observable<string | null> = this.pendingFile
      ? this.categoryService.uploadImage(this.pendingFile)
      : of(this.imageUrl());

    image$
      .pipe(
        switchMap((img) => {
          const payload = this.buildPayload(img);
          return this.isEdit
            ? this.subcategoryService.update(this.data!.subcategory!.id, payload)
            : this.subcategoryService.create(payload);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.isEdit ? 'Subcategoría actualizada correctamente' : 'Subcategoría creada correctamente',
            'Cerrar',
            { duration: 3000 },
          );
          this.dialogRef.close(true);
        },
        error: (err: Error) => {
          this.submitting.set(false);
          this.snackBar.open(err?.message || 'Error al guardar la subcategoría', 'Cerrar', { duration: 5000 });
        },
      });
  }

  private buildPayload(img: string | null): SubcategoryPayload {
    const value = this.form.getRawValue();
    return {
      name: this.cleanText(value.name),
      description: this.cleanText(value.description),
      img,
      categoryId: Number(value.categoryId),
      isAssete: !!value.isAssete,
    };
  }

  private cleanText(text: LocalizedText): LocalizedText {
    const result: LocalizedText = {};
    for (const { code } of CATEGORY_LANGS) {
      const trimmed = text?.[code]?.trim();
      if (trimmed) result[code] = trimmed;
    }
    return result;
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
