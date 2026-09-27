import {
  Component,
  DestroyRef,
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
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap } from 'rxjs';

import { CategoryService } from '../../services/category.service';
import {
  Category,
  CategoryLang,
  CategoryPayload,
  CATEGORY_LANGS,
  LocalizedText,
} from '../../../../core/models/category.interface';

export interface CategoryFormData {
  category?: Category;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatSlideToggleModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-form.component.html',
  styleUrls: ['./category-form.component.scss'],
})
export class CategoryFormComponent {
  private readonly dialogRef = inject<
    MatDialogRef<CategoryFormComponent, boolean>
  >(MatDialogRef<CategoryFormComponent, boolean>);
  private readonly data = inject<CategoryFormData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly langs = CATEGORY_LANGS;
  protected readonly acceptedTypes = ALLOWED_IMAGE_TYPES.join(',');
  protected readonly form: FormGroup;
  protected readonly isEdit: boolean;

  /** URL ya guardada en S3 (o null si no tiene / se quitó). */
  protected readonly imageUrl = signal<string | null>(null);
  /** Archivo elegido que aún no se ha subido; se sube al guardar. */
  private pendingFile: File | null = null;
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly dragOver = signal(false);
  protected readonly submitting = signal(false);

  constructor() {
    const category = this.data?.category;
    this.isEdit = !!category;
    this.imageUrl.set(category?.img ?? null);
    this.previewUrl.set(category?.img ?? null);

    this.form = this.fb.group({
      name: this.fb.group({
        es: [category?.name?.es ?? '', [Validators.required, Validators.maxLength(100)]],
        en: [category?.name?.en ?? '', [Validators.maxLength(100)]],
      }),
      description: this.fb.group({
        es: [category?.description?.es ?? '', [Validators.maxLength(1000)]],
        en: [category?.description?.en ?? '', [Validators.maxLength(1000)]],
      }),
      isAsset: [category?.isActive ?? true],
    });

    this.destroyRef.onDestroy(() => this.revokePreview());
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

    const image$: Observable<string | null> = this.pendingFile
      ? this.categoryService.uploadImage(this.pendingFile)
      : of(this.imageUrl());

    image$
      .pipe(
        switchMap((img) => {
          const payload = this.buildPayload(img);
          return this.isEdit
            ? this.categoryService.update(this.data!.category!.id, payload)
            : this.categoryService.create(payload);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.isEdit ? 'Categoría actualizada correctamente' : 'Categoría creada correctamente',
            'Cerrar',
            { duration: 3000 },
          );
          this.dialogRef.close(true);
        },
        error: (err: Error) => {
          this.submitting.set(false);
          this.snackBar.open(err?.message || 'Error al guardar la categoría', 'Cerrar', { duration: 5000 });
        },
      });
  }

  private buildPayload(img: string | null): CategoryPayload {
    const value = this.form.getRawValue();
    return {
      name: this.cleanText(value.name),
      description: this.cleanText(value.description),
      img,
      isAsset: !!value.isAsset,
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
