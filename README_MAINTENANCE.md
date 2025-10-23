# Maintenance Mode

This application includes a maintenance mode feature that can restrict access to the site while allowing authorized personnel to access it. During maintenance mode, the Supabase connection remains active, allowing admin users to perform necessary operations.

## Enabling Maintenance Mode

To enable maintenance mode, set the `NEXT_PUBLIC_MAINTENANCE_MODE` environment variable to `true` in your `.env.local` file:

```
NEXT_PUBLIC_MAINTENANCE_MODE=true
```

To disable maintenance mode, either set it to `false` or remove the variable entirely:

```
NEXT_PUBLIC_MAINTENANCE_MODE=false
```

## Bypassing Maintenance Mode

When maintenance mode is enabled, you can access the admin panel using a keyboard shortcut:

- Press `Ctrl + M` to open the access code modal
- Enter the access code (`admin123` by default)
- You will be granted access to the application for 1 hour

You can also click on the "Press Ctrl + M to access admin panel" text at the bottom of the maintenance page.

## Customizing the Access Code

For security purposes, you should change the access code in production. You can do this by modifying the maintenance page component at `src/app/maintenance/page.tsx`:

```typescript
// In the handleAccess function
if (secretCode === 'your-new-secret-code') {
  // ...
}
```

## How It Works

1. The middleware (`src/middleware.ts`) checks if maintenance mode is enabled
2. If enabled, it redirects all requests to the maintenance page (`/maintenance`)
3. Users with a valid `maintenanceBypass` cookie can access the site normally
4. The cookie is set when a user successfully enters the access code
5. The cookie is removed when a user logs in successfully
6. Supabase connection remains active during maintenance for admin operations

## Accessing During Maintenance

1. Visit the site during maintenance mode
2. Press `Ctrl + M` or click the instruction text at the bottom
3. Enter the access code (`admin123` by default)
4. You will be redirected to the main application

Note: During maintenance mode, only users with the access code can access the application. All other users will see the maintenance page. The Supabase connection remains active, so admin users can perform necessary database operations.