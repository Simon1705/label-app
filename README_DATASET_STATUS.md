# Dataset Active/Inactive Status Feature

This document describes the new feature that allows administrators to set datasets as active or inactive.

## Feature Overview

- All datasets are active by default when created
- Only administrators can toggle the active status of datasets
- Inactive datasets are hidden from regular users but still accessible to:
  - Dataset owners
  - Administrators
- Inactive datasets cannot be labeled by regular users
- Administrators can activate or deactivate datasets at any time

## Implementation Details

### Database Changes

A new `is_active` column has been added to the `datasets` table with the following properties:
- Type: `BOOLEAN`
- Default value: `TRUE`
- Nullable: Yes (but will be set to TRUE for all existing datasets)

### Visual Indicators

- Inactive datasets are clearly marked with a "Inactive" badge in the dashboard and datasets pages
- Dataset detail pages show a prominent "Inactive" indicator next to the dataset name
- Labeling pages also show the inactive status to make it clear to users
- View Details and Continue buttons are darkened for inactive datasets and show an alert when clicked

### Code Changes

1. **Type Definitions**: 
   - Updated the `Dataset` interface in `src/types/index.ts` to include the `is_active` property

2. **Admin Panel**:
   - Added toggle buttons in the admin datasets list to activate/deactivate datasets
   - Visual indicators show the current status of each dataset
   - Added a new column in the admin dashboard to show dataset status

3. **User Interface**:
   - Regular users only see active datasets when browsing datasets they've joined
   - Dataset owners can still see all their datasets (both active and inactive)
   - Attempting to access an inactive dataset as a regular user will redirect to the dashboard

4. **Backend Logic**:
   - Updated database queries to filter out inactive datasets for regular users
   - Added checks in the labeling client to prevent labeling of inactive datasets

## Migration

To apply this feature to an existing database:

1. Run the migration script in `src/lib/migrations/add-dataset-active-status.sql`
2. Or use the migration API endpoint `/api/migrate-dataset-active-status`
3. Or use the Migration Card component in the admin dashboard

## Usage

### For Administrators

1. Navigate to the Admin Dashboard or Admin Datasets page
2. Find the dataset you want to modify
3. Click the "Activate" or "Deactivate" button next to the dataset
4. The status will update immediately and be reflected throughout the application

### For Regular Users

- Inactive datasets will not appear in your dataset lists
- If you try to access an inactive dataset directly, you'll be redirected to your dashboard
- Dataset owners can still access their inactive datasets

## Security

- Only administrators can toggle dataset status
- Row Level Security (RLS) policies have been updated to respect the active status
- Dataset owners retain full access to their datasets regardless of active status