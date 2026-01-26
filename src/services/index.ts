/**
 * Services Layer Barrel Export
 * 
 * Central export point for all domain services.
 */

export { authService } from './auth.service';
export { accountsService } from './accounts.service';
export { usersService } from './users.service';
export { contactsService } from './contacts.service';
export { salesService } from './sales.service';
export { productsService } from './products.service';
export { tagsService } from './tags.service';

// Existing services are imported directly where needed
// chatwootApi and chatwootMetricsApi remain as standalone modules
