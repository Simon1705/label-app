import { Suspense } from 'react';
import UserEditClient from '@/components/UserEditClient';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Suspense fallback={<div className="flex justify-center py-10">Loading...</div>}>
      <UserEditClient id={id} />
    </Suspense>
  );
} 