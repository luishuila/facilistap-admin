import { Injectable } from '@angular/core';
export { UserService } from './user.service';
export { RoleService } from './role.service';
export { PermissionService } from './permission.service';
export { CategoryService } from './category.service';
export { SubcategoryService } from './subcategory.service';
export { EmployeeService } from './employee.service';
export { ProviderService } from './provider.service';
export { PqrsService } from './pqrs.service';
export { CountryService } from './country.service';
export { StateService } from './state.service';
export { CityService } from './city.service';
export { DashboardService } from './dashboard.service';
export { AuditService } from './audit.service';
export { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class AdminService {}
