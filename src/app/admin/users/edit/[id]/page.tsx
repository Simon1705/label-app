'use client';

import { Suspense } from 'react';
import UserEditClient from '@/components/UserEditClient'; 

interface PageParams {
  params: {
    id: string;
  };
}

export default function EditUserPage({ params }: PageParams) {
  return (
    <Suspense fallback={<div className="flex justify-center py-10">Loading...</div>}>
      <UserEditClient id={params.id} />
    </Suspense>
  );
} 