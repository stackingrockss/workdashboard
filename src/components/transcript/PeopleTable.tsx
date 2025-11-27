'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import type { PersonExtracted } from '@/types/granola-note';

interface PeopleTableProps {
  people: PersonExtracted[];
  opportunityId?: string;
  onImportComplete?: () => void;
  onImport?: (person: PersonExtracted) => void;
}

export function PeopleTable({ people, onImport }: PeopleTableProps) {
  if (people.length === 0) {
    return (
      <p className='text-sm text-muted-foreground py-4'>
        No people extracted from transcript
      </p>
    );
  }

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'decision_maker':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'champion':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'influencer':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'blocker':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Organization</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Classification</TableHead>
          {onImport && <TableHead className='text-right'>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.map((person, idx) => (
          <TableRow key={idx}>
            <TableCell className='font-medium'>{person.name}</TableCell>
            <TableCell>{person.organization}</TableCell>
            <TableCell>{person.role}</TableCell>
            <TableCell>
              {person.classifiedRole && (
                <Badge className={getRoleBadgeColor(person.classifiedRole)}>
                  {person.classifiedRole.replace('_', ' ')}
                </Badge>
              )}
            </TableCell>
            {onImport && (
              <TableCell className='text-right'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => onImport(person)}
                >
                  <UserPlus className='h-4 w-4' />
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
