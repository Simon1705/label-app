'use client';

import { Suspense } from 'react';
import UserEditClient from '@/components/UserEditClient'; 

type Props = {
  params: { id: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function EditUserPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="flex justify-center py-10">Loading...</div>}>
      <UserEditClient id={params.id} />
    </Suspense>
  );
} 