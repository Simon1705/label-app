import { Suspense } from 'react';
import UserEditClient from '@/components/UserEditClient';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function EditUserPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div className="flex justify-center py-10">Loading...</div>}>
      <UserEditClient id={params.id} />
    </Suspense>
  );
} 